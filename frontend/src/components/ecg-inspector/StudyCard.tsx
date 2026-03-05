import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import type { Study } from './types'
import { Field } from './Field'

function fmtDate(d: string) {
  if (!d || d.length < 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function fmtTime(t: string) {
  if (!t || t.length < 6) return t
  return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
}

export function StudyCard({ study }: { study: Study }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Study
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="Date" value={fmtDate(study.date)} />
          <Field label="Time" value={fmtTime(study.time)} />
          <Field label="Study UID" value={study.uid} mono />
        </div>
      </CardContent>
    </Card>
  )
}
