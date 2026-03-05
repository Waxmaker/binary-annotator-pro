package handlers

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/LIRYC-IHU/hl7v3-aecg/hl7aecg"
	aecgtypes "github.com/LIRYC-IHU/hl7v3-aecg/hl7aecg/types"
	"github.com/labstack/echo/v4"
	"github.com/suyashkumar/dicom"
	"github.com/suyashkumar/dicom/pkg/tag"
)

// ── Response types ────────────────────────────────────────────────────────────

type ecgFileResponse struct {
	Format      string          `json:"format"`
	Patient     ecgPatient      `json:"patient"`
	Device      ecgDevice       `json:"device"`
	Study       ecgStudy        `json:"study"`
	Waveforms   []ecgWaveform   `json:"waveforms"`
	Annotations []ecgAnnotation `json:"annotations"`
}

type ecgPatient struct {
	Name      string `json:"name"`
	ID        string `json:"id"`
	BirthDate string `json:"birthDate"`
	Sex       string `json:"sex"`
	Age       string `json:"age"`
}

type ecgDevice struct {
	Manufacturer    string `json:"manufacturer"`
	Model           string `json:"model"`
	Serial          string `json:"serial"`
	SoftwareVersion string `json:"softwareVersion"`
	InstitutionName string `json:"institutionName"`
	OperatorsName   string `json:"operatorsName"`
}

type ecgStudy struct {
	Date string `json:"date"`
	Time string `json:"time"`
	UID  string `json:"uid"`
}

type ecgWaveform struct {
	Index                int          `json:"index"`
	Originality          string       `json:"originality"`
	Label                string       `json:"label"`
	SamplingFrequency    float64      `json:"samplingFrequency"`
	NumberOfChannels     int          `json:"numberOfChannels"`
	NumberOfSamples      int          `json:"numberOfSamples"`
	BitsAllocated        int          `json:"bitsAllocated"`
	SampleInterpretation string       `json:"sampleInterpretation"`
	DurationSeconds      float64      `json:"durationSeconds"`
	Channels             []ecgChannel `json:"channels"`
}

type ecgChannel struct {
	Index                int       `json:"index"`
	Label                string    `json:"label"`
	SourceName           string    `json:"sourceName"`
	Code                 string    `json:"code,omitempty"`
	Sensitivity          float64   `json:"sensitivity"`
	SensitivityUnit      string    `json:"sensitivityUnit"`
	Baseline             float64   `json:"baseline"`
	FilterLowFrequency   float64   `json:"filterLowFrequency"`
	FilterHighFrequency  float64   `json:"filterHighFrequency"`
	NotchFilterFrequency float64   `json:"notchFilterFrequency"`
	Samples              []float64 `json:"samples,omitempty"`
}

type ecgAnnotation struct {
	ConceptName  string `json:"conceptName"`
	Code         string `json:"code"`
	CodeSystem   string `json:"codeSystem"`
	NumericValue string `json:"numericValue"`
	Unit         string `json:"unit"`
	TextValue    string `json:"textValue"`
}

// ── Handler ───────────────────────────────────────────────────────────────────

func (h *Handler) ParseECGFile(c echo.Context) error {
	file, header, err := c.Request().FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "missing file field"})
	}
	defer file.Close()

	buf, err := io.ReadAll(file)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "read error"})
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))

	var result *ecgFileResponse
	switch ext {
	case ".dcm", ".dicom", "":
		result, err = ecgParseDICOM(buf)
	case ".xml":
		result, err = ecgParseFDAXML(buf)
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("unsupported extension: %s", ext)})
	}

	if err != nil {
		return c.JSON(http.StatusUnprocessableEntity, map[string]string{"error": fmt.Sprintf("parse error: %v", err)})
	}

	return c.JSON(http.StatusOK, result)
}

// ── DICOM parser ──────────────────────────────────────────────────────────────

func ecgParseDICOM(buf []byte) (*ecgFileResponse, error) {
	ds, err := dicom.Parse(bytes.NewReader(buf), int64(len(buf)), nil)
	if err != nil {
		return nil, fmt.Errorf("dicom parse: %w", err)
	}

	result := &ecgFileResponse{Format: "dicom"}

	result.Patient = ecgPatient{
		Name:      ecgGetDICOMString(ds, tag.PatientName),
		ID:        ecgGetDICOMString(ds, tag.PatientID),
		BirthDate: ecgGetDICOMString(ds, tag.PatientBirthDate),
		Sex:       ecgGetDICOMString(ds, tag.PatientSex),
		Age:       ecgGetDICOMString(ds, tag.PatientAge),
	}
	result.Device = ecgDevice{
		Manufacturer:    ecgGetDICOMString(ds, tag.Manufacturer),
		Model:           ecgGetDICOMString(ds, tag.ManufacturerModelName),
		Serial:          ecgGetDICOMString(ds, tag.DeviceSerialNumber),
		SoftwareVersion: ecgGetDICOMString(ds, tag.SoftwareVersions),
		InstitutionName: ecgGetDICOMString(ds, tag.InstitutionName),
		OperatorsName:   ecgGetDICOMString(ds, tag.OperatorsName),
	}

	studyUID := ecgGetDICOMString(ds, tag.StudyInstanceUID)
	studyDate := ecgGetDICOMString(ds, tag.StudyDate)
	studyTime := ecgGetDICOMString(ds, tag.StudyTime)
	if studyDate == "" && studyUID != "" {
		studyDate, studyTime = ecgDateFromPhilipsUID(studyUID)
	}
	result.Study = ecgStudy{Date: studyDate, Time: studyTime, UID: studyUID}

	if wfElem, err2 := ds.FindElementByTag(tag.WaveformSequence); err2 == nil {
		if items, ok := wfElem.Value.GetValue().([]*dicom.SequenceItemValue); ok {
			for i, item := range items {
				elems := item.GetValue().([]*dicom.Element)
				result.Waveforms = append(result.Waveforms, ecgParseDICOMWaveformGroup(i, elems))
			}
		}
	}

	if annElem, err2 := ds.FindElementByTag(tag.WaveformAnnotationSequence); err2 == nil {
		if items, ok := annElem.Value.GetValue().([]*dicom.SequenceItemValue); ok {
			for _, item := range items {
				elems := item.GetValue().([]*dicom.Element)
				ann := ecgParseDICOMAnnotation(elems)
				if ann.ConceptName != "" || ann.NumericValue != "" {
					result.Annotations = append(result.Annotations, ann)
				}
			}
		}
	}

	return result, nil
}

func ecgParseDICOMWaveformGroup(idx int, elements []*dicom.Element) ecgWaveform {
	wf := ecgWaveform{Index: idx}

	if e := ecgFindElem(elements, tag.WaveformOriginality); e != nil {
		wf.Originality = ecgElemStr(e)
	}
	if e := ecgFindElem(elements, tag.MultiplexGroupLabel); e != nil {
		wf.Label = ecgElemStr(e)
	}
	if e := ecgFindElem(elements, tag.SamplingFrequency); e != nil {
		wf.SamplingFrequency, _ = strconv.ParseFloat(ecgElemStr(e), 64)
	}
	if e := ecgFindElem(elements, tag.NumberOfWaveformChannels); e != nil {
		wf.NumberOfChannels = ecgElemInt(e)
	}
	if e := ecgFindElem(elements, tag.NumberOfWaveformSamples); e != nil {
		wf.NumberOfSamples = ecgElemInt(e)
	}
	if e := ecgFindElem(elements, tag.WaveformBitsAllocated); e != nil {
		wf.BitsAllocated = ecgElemInt(e)
	}
	if e := ecgFindElem(elements, tag.WaveformSampleInterpretation); e != nil {
		wf.SampleInterpretation = ecgElemStr(e)
	}
	if wf.SamplingFrequency > 0 {
		wf.DurationSeconds = float64(wf.NumberOfSamples) / wf.SamplingFrequency
	}

	if e := ecgFindElem(elements, tag.ChannelDefinitionSequence); e != nil {
		if chItems, ok := e.Value.GetValue().([]*dicom.SequenceItemValue); ok {
			for i, ch := range chItems {
				chElems := ch.GetValue().([]*dicom.Element)
				wf.Channels = append(wf.Channels, ecgParseDICOMChannel(i, chElems))
			}
		}
	}

	// Extract raw waveform sample data and apply sensitivity/baseline scaling
	if wfDataElem := ecgFindElem(elements, tag.WaveformData); wfDataElem != nil {
		if rawBytes, ok := wfDataElem.Value.GetValue().([]byte); ok && len(rawBytes) > 0 {
			ecgExtractDICOMSamples(&wf, rawBytes)
		}
	}

	return wf
}

// ecgExtractDICOMSamples de-multiplexes interleaved waveform bytes into per-channel
// physical values: physical = (raw - baseline) * sensitivity
func ecgExtractDICOMSamples(wf *ecgWaveform, data []byte) {
	nCh := wf.NumberOfChannels
	nSamples := wf.NumberOfSamples
	bytesPerSample := wf.BitsAllocated / 8
	if nCh == 0 || nSamples == 0 || bytesPerSample == 0 {
		return
	}
	if len(data) < nCh*nSamples*bytesPerSample {
		return
	}
	signed := wf.SampleInterpretation == "SS" || wf.SampleInterpretation == "SB"

	for i := range wf.Channels {
		wf.Channels[i].Samples = make([]float64, nSamples)
	}
	for s := 0; s < nSamples; s++ {
		for c := 0; c < nCh && c < len(wf.Channels); c++ {
			offset := (s*nCh + c) * bytesPerSample
			var raw float64
			switch bytesPerSample {
			case 2:
				u16 := binary.LittleEndian.Uint16(data[offset : offset+2])
				if signed {
					raw = float64(int16(u16))
				} else {
					raw = float64(u16)
				}
			case 1:
				if signed {
					raw = float64(int8(data[offset]))
				} else {
					raw = float64(data[offset])
				}
			}
			ch := wf.Channels[c]
			wf.Channels[c].Samples[s] = (raw - ch.Baseline) * ch.Sensitivity
		}
	}
}

func ecgParseDICOMChannel(idx int, elements []*dicom.Element) ecgChannel {
	ch := ecgChannel{Index: idx}

	if e := ecgFindElem(elements, tag.ChannelLabel); e != nil {
		ch.Label = ecgElemStr(e)
	}
	if e := ecgFindElem(elements, tag.ChannelSensitivity); e != nil {
		ch.Sensitivity, _ = strconv.ParseFloat(ecgElemStr(e), 64)
	}
	if e := ecgFindElem(elements, tag.ChannelBaseline); e != nil {
		ch.Baseline, _ = strconv.ParseFloat(ecgElemStr(e), 64)
	}
	if e := ecgFindElem(elements, tag.FilterLowFrequency); e != nil {
		ch.FilterLowFrequency, _ = strconv.ParseFloat(ecgElemStr(e), 64)
	}
	if e := ecgFindElem(elements, tag.FilterHighFrequency); e != nil {
		ch.FilterHighFrequency, _ = strconv.ParseFloat(ecgElemStr(e), 64)
	}
	if e := ecgFindElem(elements, tag.NotchFilterFrequency); e != nil {
		ch.NotchFilterFrequency, _ = strconv.ParseFloat(ecgElemStr(e), 64)
	}
	if e := ecgFindElem(elements, tag.ChannelSensitivityUnitsSequence); e != nil {
		if units, ok := e.Value.GetValue().([]*dicom.SequenceItemValue); ok && len(units) > 0 {
			unitElems := units[0].GetValue().([]*dicom.Element)
			if cv := ecgFindElem(unitElems, tag.CodeMeaning); cv != nil {
				ch.SensitivityUnit = ecgElemStr(cv)
			}
		}
	}
	if e := ecgFindElem(elements, tag.ChannelSourceSequence); e != nil {
		if src, ok := e.Value.GetValue().([]*dicom.SequenceItemValue); ok && len(src) > 0 {
			srcElems := src[0].GetValue().([]*dicom.Element)
			if cv := ecgFindElem(srcElems, tag.CodeMeaning); cv != nil {
				ch.SourceName = ecgElemStr(cv)
			}
		}
	}

	return ch
}

func ecgParseDICOMAnnotation(elements []*dicom.Element) ecgAnnotation {
	var a ecgAnnotation

	if e := ecgFindElem(elements, tag.ConceptNameCodeSequence); e != nil {
		if items, ok := e.Value.GetValue().([]*dicom.SequenceItemValue); ok && len(items) > 0 {
			elems := items[0].GetValue().([]*dicom.Element)
			if cv := ecgFindElem(elems, tag.CodeMeaning); cv != nil {
				a.ConceptName = ecgElemStr(cv)
			}
			if cv := ecgFindElem(elems, tag.CodeValue); cv != nil {
				a.Code = ecgElemStr(cv)
			}
			if cv := ecgFindElem(elems, tag.CodingSchemeDesignator); cv != nil {
				a.CodeSystem = ecgElemStr(cv)
			}
		}
	}
	if e := ecgFindElem(elements, tag.TextValue); e != nil {
		a.TextValue = ecgElemStr(e)
	}
	if e := ecgFindElem(elements, tag.MeasuredValueSequence); e != nil {
		if items, ok := e.Value.GetValue().([]*dicom.SequenceItemValue); ok && len(items) > 0 {
			mvElems := items[0].GetValue().([]*dicom.Element)
			if nv := ecgFindElem(mvElems, tag.NumericValue); nv != nil {
				a.NumericValue = ecgElemStr(nv)
			}
			if ue := ecgFindElem(mvElems, tag.MeasurementUnitsCodeSequence); ue != nil {
				if unitItems, ok := ue.Value.GetValue().([]*dicom.SequenceItemValue); ok && len(unitItems) > 0 {
					unitElems := unitItems[0].GetValue().([]*dicom.Element)
					if cv := ecgFindElem(unitElems, tag.CodeMeaning); cv != nil {
						a.Unit = ecgElemStr(cv)
					}
				}
			}
		}
	}
	// Philips fallback
	if a.NumericValue == "" {
		if nv := ecgFindElem(elements, tag.NumericValue); nv != nil {
			a.NumericValue = ecgElemStr(nv)
		}
	}
	if a.Unit == "" {
		if ue := ecgFindElem(elements, tag.MeasurementUnitsCodeSequence); ue != nil {
			if unitItems, ok := ue.Value.GetValue().([]*dicom.SequenceItemValue); ok && len(unitItems) > 0 {
				unitElems := unitItems[0].GetValue().([]*dicom.Element)
				if cv := ecgFindElem(unitElems, tag.CodeMeaning); cv != nil {
					a.Unit = ecgElemStr(cv)
				}
			}
		}
	}

	return a
}

// ── FDA aECG XML parser (via github.com/LIRYC-IHU/hl7v3-aecg) ───────────────

var ecgMDCDisplayName = map[string]string{
	"MDC_ECG_HEART_RATE":                    "Heart Rate",
	"MDC_ECG_TIME_PD_PR":                    "PR Interval",
	"MDC_ECG_TIME_PD_QRS":                   "QRS Duration",
	"MDC_ECG_TIME_PD_QT":                    "QT Interval",
	"MDC_ECG_TIME_PD_QTc":                   "QTc Interval",
	"MDC_ECG_TIME_PD_QTcB":                  "QTc Bazett",
	"MDC_ECG_TIME_PD_QTcF":                  "QTc Fridericia",
	"5.10.2.1-3":                            "RR Interval",
	"5.10.3-11":                             "P-wave Axis",
	"5.10.3-13":                             "QRS Axis",
	"5.10.3-15":                             "T-wave Axis",
	"MDC_ECG_CTL_VBL_ATTR_FILTER_LOW_PASS":  "Low Pass Filter",
	"MDC_ECG_CTL_VBL_ATTR_FILTER_HIGH_PASS": "High Pass Filter",
	"MDC_ECG_ATRIAL_RATE":                   "Atrial Rate",
	"MDC_ECG_ANGLE_P_FRONT":                 "P Axis",
	"MDC_ECG_ANGLE_QRS_FRONT":               "QRS Axis",
	"MDC_ECG_ANGLE_T_FRONT":                 "T Axis",
	"MDC_ECG_TIME_PD_QT_DISPERSION":         "QT Dispersion",
}

var ecgMDCLeadName = map[string]string{
	"MDC_ECG_LEAD_I": "I", "MDC_ECG_LEAD_II": "II", "MDC_ECG_LEAD_III": "III",
	"MDC_ECG_LEAD_AVR": "aVR", "MDC_ECG_LEAD_AVL": "aVL", "MDC_ECG_LEAD_AVF": "aVF",
	"MDC_ECG_LEAD_V1": "V1", "MDC_ECG_LEAD_V2": "V2", "MDC_ECG_LEAD_V3": "V3",
	"MDC_ECG_LEAD_V4": "V4", "MDC_ECG_LEAD_V5": "V5", "MDC_ECG_LEAD_V6": "V6",
}

func ecgParseFDAXML(buf []byte) (*ecgFileResponse, error) {
	h := hl7aecg.NewHl7xml("")
	if err := h.Unmarshal(buf); err != nil {
		return nil, fmt.Errorf("xml parse: %w", err)
	}

	result := &ecgFileResponse{Format: "fda-xml"}
	aecg := h.HL7AEcg

	// Study UID & date
	if aecg.ID != nil {
		result.Study.UID = aecg.ID.Root
	}
	if aecg.EffectiveTime != nil {
		dateVal := aecg.EffectiveTime.Low.Value
		result.Study.Date = ecgFormatFDADate(dateVal)
		result.Study.Time = ecgFormatFDATime(dateVal)
	}

	// Patient via ComponentOf hierarchy
	if aecg.ComponentOf != nil {
		ts := aecg.ComponentOf.TimepointEvent.ComponentOf.SubjectAssignment.Subject.TrialSubject
		patientID := ""
		if ts.ID != nil {
			patientID = ts.ID.Extension
			if patientID == "" {
				patientID = ts.ID.Root
			}
		}
		var name, sex, birthDate, age string
		if dp := ts.SubjectDemographicPerson; dp != nil {
			if dp.Name != nil {
				name = strings.TrimSpace(*dp.Name)
			}
			if dp.AdministrativeGenderCode != nil {
				sex = string(dp.AdministrativeGenderCode.Code)
			}
			if dp.BirthTime != nil {
				birthDate = dp.BirthTime.Value
			}
			age = dp.Age
			if patientID == "" {
				patientID = dp.PatientID
			}
		}
		result.Patient = ecgPatient{ID: patientID, Name: name, Sex: sex, BirthDate: birthDate, Age: age}
	} else if aecg.Subject != nil {
		// Direct subject (alternative structure)
		ts := aecg.Subject
		patientID := ""
		if ts.ID != nil {
			patientID = ts.ID.Extension
			if patientID == "" {
				patientID = ts.ID.Root
			}
		}
		var name, sex, birthDate, age string
		if dp := ts.SubjectDemographicPerson; dp != nil {
			if dp.Name != nil {
				name = strings.TrimSpace(*dp.Name)
			}
			if dp.AdministrativeGenderCode != nil {
				sex = string(dp.AdministrativeGenderCode.Code)
			}
			if dp.BirthTime != nil {
				birthDate = dp.BirthTime.Value
			}
			age = dp.Age
			if patientID == "" {
				patientID = dp.PatientID
			}
		}
		result.Patient = ecgPatient{ID: patientID, Name: name, Sex: sex, BirthDate: birthDate, Age: age}
	}

	// Process series
	for i, comp := range aecg.Component {
		series := comp.Series

		// Device from first series author
		if i == 0 && series.Author != nil {
			sa := series.Author.SeriesAuthor
			manufacturer := ""
			if sa.ManufacturerOrganization != nil && sa.ManufacturerOrganization.Name != nil {
				manufacturer = *sa.ManufacturerOrganization.Name
			}
			model := ecgDerefStr(sa.ManufacturedSeriesDevice.ManufacturerModelName)
			serial := ecgDerefStr(sa.ManufacturedSeriesDevice.SerialNumber)
			software := ecgDerefStr(sa.ManufacturedSeriesDevice.SoftwareName)
			operator := ""
			if len(series.SecondaryPerformer) > 0 {
				sp := series.SecondaryPerformer[0].SeriesPerformer
				if sp.AssignedPerson != nil && sp.AssignedPerson.Name != nil {
					operator = strings.TrimSpace(*sp.AssignedPerson.Name)
				}
			}
			result.Device = ecgDevice{
				Manufacturer: manufacturer, Model: model, Serial: serial,
				SoftwareVersion: software, OperatorsName: operator,
			}
		}

		// Build waveform from the series
		wf := ecgBuildFDAWaveform(i, series)
		if wf.NumberOfChannels > 0 || wf.SamplingFrequency > 0 {
			// Extract filter values from ControlVariables and apply to channels
			lpf, hpf, notch := ecgExtractFDAFilters(series.ControlVariable)
			if lpf > 0 || hpf > 0 || notch > 0 {
				for ci := range wf.Channels {
					wf.Channels[ci].FilterHighFrequency = lpf
					wf.Channels[ci].FilterLowFrequency = hpf
					wf.Channels[ci].NotchFilterFrequency = notch
				}
			}
			result.Waveforms = append(result.Waveforms, wf)
		}

		// Derived series
		for _, deriv := range series.Derivation {
			dIdx := len(result.Waveforms)
			dWf := ecgBuildFDAWaveform(dIdx, deriv.DerivedSeries)
			if dWf.NumberOfChannels > 0 || dWf.SamplingFrequency > 0 {
				result.Waveforms = append(result.Waveforms, dWf)
			}
		}

		// Annotations
		for _, so := range series.SubjectOf {
			if so.AnnotationSet == nil {
				continue
			}
			for _, annComp := range so.AnnotationSet.Component {
				ann := annComp.Annotation
				ecgAnn, ok := ecgBuildFDAAnnotation(ann)
				if !ok {
					continue
				}
				result.Annotations = append(result.Annotations, ecgAnn)
				// Nested annotations (e.g. QTc correction formulas)
				for _, nested := range ann.Component {
					nAnn, nOk := ecgBuildFDAAnnotation(nested.Annotation)
					if nOk {
						result.Annotations = append(result.Annotations, nAnn)
					}
				}
			}
		}
	}

	return result, nil
}

func ecgBuildFDAWaveform(idx int, series aecgtypes.Series) ecgWaveform {
	wf := ecgWaveform{Index: idx, Originality: "ORIGINAL", Label: "RHYTHM"}
	if series.Code != nil {
		label := string(series.Code.Code)
		wf.Label = label
		if label == "REPRESENTATIVE_BEAT" || label == "MEDIAN_BEAT" || label == "DERIVED" {
			wf.Originality = "DERIVED"
		}
	}

	for _, sc := range series.Component {
		for _, seqComp := range sc.SequenceSet.Component {
			seq := seqComp.Sequence
			if seq.Value == nil {
				continue
			}
			if seq.Code.Time != nil {
				// Extract sampling frequency from time sequence increment
				if wf.SamplingFrequency == 0 {
					switch v := seq.Value.Typed.(type) {
					case *aecgtypes.GLIST_TS:
						if incr, err := strconv.ParseFloat(v.Increment.Value, 64); err == nil && incr > 0 {
							wf.SamplingFrequency = 1.0 / incr
						}
					case *aecgtypes.GLIST_PQ:
						if incr, err := strconv.ParseFloat(v.Increment.Value, 64); err == nil && incr > 0 {
							wf.SamplingFrequency = 1.0 / incr
						}
					}
				}
			} else if seq.Code.Lead != nil {
				leadCode := string(seq.Code.Lead.Code)
				leadName := ecgMDCLeadName[leadCode]
				if leadName == "" {
					leadName = seq.Code.Lead.DisplayName
				}
				if leadName == "" {
					leadName = leadCode
				}
				ch := ecgChannel{Index: len(wf.Channels), SourceName: leadName, Code: leadCode}
				if slistPQ, ok := seq.Value.Typed.(*aecgtypes.SLIST_PQ); ok {
					ch.Sensitivity, _ = strconv.ParseFloat(slistPQ.Scale.Value, 64)
					ch.SensitivityUnit = slistPQ.Scale.Unit
					if wf.NumberOfSamples == 0 {
						wf.NumberOfSamples = slistPQ.GetLength()
					}
					if vals, err := slistPQ.GetActualValues(); err == nil {
						ch.Samples = vals
					}
				}
				wf.Channels = append(wf.Channels, ch)
			}
		}
	}

	wf.NumberOfChannels = len(wf.Channels)
	if wf.SamplingFrequency > 0 && wf.NumberOfSamples > 0 {
		wf.DurationSeconds = float64(wf.NumberOfSamples) / wf.SamplingFrequency
	}
	return wf
}

func ecgExtractFDAFilters(cvs []aecgtypes.ControlVariable) (lpf, hpf, notch float64) {
	for _, cv := range cvs {
		inner := cv.ControlVariable
		if inner == nil || inner.Code == nil {
			continue
		}
		outerCode := string(inner.Code.Code)
		// Value may be directly on the inner CV (simple) or in nested component (filter style)
		var val float64
		if inner.Value != nil {
			val, _ = strconv.ParseFloat(inner.Value.Value, 64)
		}
		for _, comp := range inner.Component {
			if comp.ControlVariable != nil && comp.ControlVariable.Value != nil {
				val, _ = strconv.ParseFloat(comp.ControlVariable.Value.Value, 64)
			}
		}
		switch outerCode {
		case "MDC_ECG_CTL_VBL_ATTR_FILTER_LOW_PASS":
			lpf = val
		case "MDC_ECG_CTL_VBL_ATTR_FILTER_HIGH_PASS":
			hpf = val
		case "MDC_ECG_CTL_VBL_ATTR_FILTER_NOTCH", "MDC_ECG_CTL_VBL_ATTR_FILTER_NOTCH_FREQ":
			notch = val
		}
	}
	return
}

func ecgBuildFDAAnnotation(ann aecgtypes.Annotation) (ecgAnnotation, bool) {
	if ann.Code == nil {
		return ecgAnnotation{}, false
	}
	conceptName := ann.Code.DisplayName
	if conceptName == "" {
		conceptName = ecgMDCDisplayName[ann.Code.Code]
	}
	if conceptName == "" {
		conceptName = ann.Code.Code
	}
	a := ecgAnnotation{
		ConceptName: conceptName,
		Code:        ann.Code.Code,
		CodeSystem:  ann.Code.CodeSystem,
	}
	if ann.Value != nil {
		if pq, ok := ann.Value.Typed.(*aecgtypes.PhysicalQuantity); ok {
			a.NumericValue = pq.Value
			a.Unit = pq.Unit
		} else if st, ok := ann.Value.Typed.(*aecgtypes.StringValue); ok {
			a.TextValue = st.Value
		}
	}
	if a.ConceptName == "" && a.NumericValue == "" && a.TextValue == "" {
		return ecgAnnotation{}, false
	}
	return a, true
}

// ── DICOM helpers ─────────────────────────────────────────────────────────────

func ecgGetDICOMString(ds dicom.Dataset, t tag.Tag) string {
	elem, err := ds.FindElementByTag(t)
	if err != nil {
		return ""
	}
	return ecgElemStr(elem)
}

func ecgElemStr(elem *dicom.Element) string {
	vals, ok := elem.Value.GetValue().([]string)
	if !ok || len(vals) == 0 {
		return ""
	}
	return strings.TrimSpace(vals[0])
}

func ecgElemInt(elem *dicom.Element) int {
	switch v := elem.Value.GetValue().(type) {
	case []int:
		if len(v) > 0 {
			return v[0]
		}
	case []string:
		if len(v) > 0 {
			n, _ := strconv.Atoi(strings.TrimSpace(v[0]))
			return n
		}
	}
	return 0
}

func ecgFindElem(elements []*dicom.Element, t tag.Tag) *dicom.Element {
	for _, e := range elements {
		if e.Tag == t {
			return e
		}
	}
	return nil
}

func ecgDateFromPhilipsUID(uid string) (date, timeStr string) {
	parts := strings.Split(uid, ".")
	for i := len(parts) - 2; i >= 0; i-- {
		ts, err := strconv.ParseInt(parts[i], 10, 64)
		if err != nil {
			continue
		}
		if ts >= 946684800 && ts <= 4102444800 {
			t := time.Unix(ts, 0).UTC()
			return t.Format("20060102"), t.Format("150405")
		}
	}
	return "", ""
}

func ecgFormatFDADate(v string) string {
	if len(v) < 8 {
		return v
	}
	return v[:8]
}

func ecgFormatFDATime(v string) string {
	if len(v) < 14 {
		return ""
	}
	return v[8:14]
}

func ecgDerefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
