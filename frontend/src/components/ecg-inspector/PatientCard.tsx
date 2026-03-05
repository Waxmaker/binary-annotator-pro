import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from 'lucide-react'
import type { Patient } from './types'
import { Field } from './Field'

function fmtDate(d: string) {
  if (!d || d.length < 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function fmtSex(s: string) {
  return s === 'M' ? 'Male' : s === 'F' ? 'Female' : s || undefined
}

export function PatientCard({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Patient
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-4">
          <Field label="Name"       value={patient.name} />
          <Field label="Patient ID" value={patient.id} mono />
          <Field label="Sex"        value={fmtSex(patient.sex)} />
          <Field label="Age"        value={patient.age} />
          <Field label="Birth Date" value={fmtDate(patient.birthDate)} />
        </div>
      </CardContent>
    </Card>
  )
}
