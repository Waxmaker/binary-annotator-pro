import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, TableProperties } from 'lucide-react'
import type { Waveform } from './types'

const PAGE_SIZE = 100

function fmt(v: number) {
  return v.toFixed(2)
}

function LeadTable({ waveform }: { waveform: Waveform }) {
  const [page, setPage] = useState(0)

  const channels = useMemo(
    () => waveform.channels.filter(ch => ch.samples && ch.samples.length > 0),
    [waveform],
  )

  const nSamples = channels[0]?.samples?.length ?? 0
  const totalPages = Math.ceil(nSamples / PAGE_SIZE)
  const msPerSample = waveform.samplingFrequency > 0 ? 1000 / waveform.samplingFrequency : 0

  const start = page * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, nSamples)
  const rows = Array.from({ length: end - start }, (_, i) => start + i)

  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 px-2">No sample data available.</p>
    )
  }

  const unit = channels[0]?.sensitivityUnit || ''

  return (
    <div className="flex flex-col gap-3">
      {/* Stats row */}
      <div className="flex flex-wrap gap-2 px-1">
        {channels.map(ch => {
          const s = ch.samples!
          const min = Math.min(...s)
          const max = Math.max(...s)
          const mean = s.reduce((a, b) => a + b, 0) / s.length
          const name = ch.sourceName || ch.label || `Ch ${ch.index}`
          return (
            <div key={ch.index} className="text-xs border rounded px-2 py-1 bg-muted/30">
              <span className="font-medium">{name}</span>
              <span className="text-muted-foreground ml-2">
                min {fmt(min)} / max {fmt(max)} / avg {fmt(mean)} {unit}
              </span>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-14 sticky left-0 bg-background z-10">#</TableHead>
              {msPerSample > 0 && (
                <TableHead className="text-xs w-20 sticky left-14 bg-background z-10">
                  Time (ms)
                </TableHead>
              )}
              {channels.map(ch => (
                <TableHead key={ch.index} className="text-xs text-center whitespace-nowrap">
                  {ch.sourceName || ch.label || `Ch ${ch.index}`}
                  {unit && <span className="text-muted-foreground ml-1">({unit})</span>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(i => (
              <TableRow key={i} className="h-7">
                <TableCell className="text-xs font-mono py-0.5 sticky left-0 bg-background">
                  {i}
                </TableCell>
                {msPerSample > 0 && (
                  <TableCell className="text-xs font-mono py-0.5 sticky left-14 bg-background text-muted-foreground">
                    {(i * msPerSample).toFixed(1)}
                  </TableCell>
                )}
                {channels.map(ch => (
                  <TableCell key={ch.index} className="text-xs font-mono py-0.5 text-center">
                    {fmt(ch.samples![i])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">
            Samples {start + 1}–{end} of {nSamples}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function LeadDataView({ waveforms }: { waveforms: Waveform[] }) {
  const withData = waveforms.filter(w =>
    w.channels.some(ch => ch.samples && ch.samples.length > 0),
  )

  if (withData.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TableProperties className="h-4 w-4 text-primary" />
          Lead Data
          <Badge variant="secondary" className="ml-1">numeric</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {withData.length === 1 ? (
          <LeadTable waveform={withData[0]} />
        ) : (
          <Tabs defaultValue={String(withData[0].index)}>
            <TabsList className="mb-3">
              {withData.map(w => (
                <TabsTrigger key={w.index} value={String(w.index)} className="text-xs">
                  {w.label || `Waveform ${w.index}`}
                  <Badge variant="outline" className="ml-1.5 text-xs">
                    {w.channels.find(ch => ch.samples)?.samples?.length ?? 0} samples
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {withData.map(w => (
              <TabsContent key={w.index} value={String(w.index)}>
                <LeadTable waveform={w} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
