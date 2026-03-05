import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cpu } from 'lucide-react'
import type { Device } from './types'
import { Field } from './Field'

export function DeviceCard({ device }: { device: Device }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          Device
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-4">
          <Field label="Manufacturer"     value={device.manufacturer} />
          <Field label="Model"            value={device.model} />
          <Field label="Serial"           value={device.serial} mono />
          <Field label="Software"         value={device.softwareVersion} mono />
          <Field label="Institution"      value={device.institutionName} />
          <Field label="Operator"         value={device.operatorsName} />
        </div>
      </CardContent>
    </Card>
  )
}
