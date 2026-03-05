export interface ECGFile {
  format: 'dicom' | 'fda-xml'
  patient: Patient
  device: Device
  study: Study
  waveforms: Waveform[]
  annotations: Annotation[]
}

export interface Patient {
  name: string
  id: string
  birthDate: string
  sex: string
  age: string
}

export interface Device {
  manufacturer: string
  model: string
  serial: string
  softwareVersion: string
  institutionName: string
  operatorsName: string
}

export interface Study {
  date: string
  time: string
  uid: string
}

export interface Waveform {
  index: number
  originality: string
  label: string
  samplingFrequency: number
  numberOfChannels: number
  numberOfSamples: number
  bitsAllocated: number
  sampleInterpretation: string
  durationSeconds: number
  channels: Channel[]
}

export interface Channel {
  index: number
  label: string
  sourceName: string
  code?: string
  sensitivity: number
  sensitivityUnit: string
  baseline: number
  filterLowFrequency: number
  filterHighFrequency: number
  notchFilterFrequency: number
  samples?: number[]
}

export interface Annotation {
  conceptName: string
  code: string
  codeSystem: string
  numericValue: string
  unit: string
  textValue: string
}
