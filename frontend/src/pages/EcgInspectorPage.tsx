import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Home, Upload, Stethoscope, X, FileHeart } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ECGFile } from '@/components/ecg-inspector/types'
import { PatientCard } from '@/components/ecg-inspector/PatientCard'
import { DeviceCard } from '@/components/ecg-inspector/DeviceCard'
import { StudyCard } from '@/components/ecg-inspector/StudyCard'
import { WaveformList } from '@/components/ecg-inspector/WaveformList'
import { AnnotationList } from '@/components/ecg-inspector/AnnotationList'
import { LeadDataView } from '@/components/ecg-inspector/LeadDataView'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function EcgInspectorPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [ecgFile, setEcgFile] = useState<ECGFile | null>(null)
  const [fileName, setFileName] = useState<string>('')

  async function parseFile(file: File) {
    setIsParsing(true)
    setFileName(file.name)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/ecg-inspector/parse`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || res.statusText)
      }
      const data: ECGFile = await res.json()
      setEcgFile(data)
    } catch (e: any) {
      toast({
        title: 'Parse error',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setIsParsing(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    parseFile(files[0])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleReset() {
    setEcgFile(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatLabel = ecgFile?.format === 'dicom' ? 'DICOM' : ecgFile?.format === 'fda-xml' ? 'FDA aECG XML' : ''

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel-header flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">ECG Inspector</h1>
            <p className="text-xs text-muted-foreground">Parse and inspect DICOM / FDA aECG XML files</p>
          </div>
          {ecgFile && (
            <div className="flex items-center gap-2 ml-4">
              <Badge variant="outline" className="text-xs font-mono">{fileName}</Badge>
              <Badge variant="secondary" className="text-xs">{formatLabel}</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ecgFile && (
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
            <Home className="h-4 w-4" />
            Binary Workbench
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {!ecgFile ? (
          /* Upload area */
          <div className="h-full flex items-center justify-center p-8">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                w-full max-w-xl border-2 border-dashed rounded-xl p-12 text-center
                transition-colors cursor-pointer
                ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'}
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileHeart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-base font-medium text-foreground mb-1">
                {isParsing ? 'Parsing…' : 'Drop an ECG file here'}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Supports DICOM (.dcm) and FDA aECG XML (.xml)
              </p>
              <Button variant="outline" className="gap-2" disabled={isParsing}>
                <Upload className="h-4 w-4" />
                Browse file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dcm,.xml,application/dicom,text/xml,application/xml"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
          </div>
        ) : (
          /* Results */
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4 max-w-7xl mx-auto">
              <PatientCard patient={ecgFile.patient} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DeviceCard device={ecgFile.device} />
                <StudyCard study={ecgFile.study} />
              </div>
              <Separator />
              <WaveformList waveforms={ecgFile.waveforms} />
              <LeadDataView waveforms={ecgFile.waveforms} />
              <AnnotationList annotations={ecgFile.annotations} />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
