import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronRight, Activity } from 'lucide-react'
import type { Waveform } from './types'

function WaveformRow({ waveform }: { waveform: Waveform }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(v => !v)}
      >
        <TableCell className="w-8">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          }
        </TableCell>
        <TableCell className="font-mono text-xs">{waveform.index}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">{waveform.label || '—'}</Badge>
        </TableCell>
        <TableCell className="text-xs">{waveform.originality || '—'}</TableCell>
        <TableCell className="text-xs font-mono">{waveform.samplingFrequency} Hz</TableCell>
        <TableCell className="text-xs">{waveform.numberOfChannels}</TableCell>
        <TableCell className="text-xs font-mono">{waveform.numberOfSamples}</TableCell>
        <TableCell className="text-xs">{waveform.durationSeconds.toFixed(2)} s</TableCell>
        <TableCell className="text-xs">{waveform.bitsAllocated} bit</TableCell>
      </TableRow>

      {expanded && waveform.channels?.length > 0 && (
        <TableRow>
          <TableCell colSpan={9} className="p-0 bg-muted/20">
            <div className="px-6 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Channels ({waveform.channels.length})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-7">#</TableHead>
                    <TableHead className="text-xs h-7">Label</TableHead>
                    <TableHead className="text-xs h-7">Source</TableHead>
                    <TableHead className="text-xs h-7">Sensitivity</TableHead>
                    <TableHead className="text-xs h-7">Baseline</TableHead>
                    <TableHead className="text-xs h-7">Filter Low</TableHead>
                    <TableHead className="text-xs h-7">Filter High</TableHead>
                    <TableHead className="text-xs h-7">Notch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waveform.channels.map(ch => (
                    <TableRow key={ch.index}>
                      <TableCell className="text-xs py-1 font-mono">{ch.index}</TableCell>
                      <TableCell className="text-xs py-1">
                        <Badge variant="secondary" className="text-xs">{ch.label || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs py-1">{ch.sourceName || '—'}</TableCell>
                      <TableCell className="text-xs py-1 font-mono">
                        {ch.sensitivity} {ch.sensitivityUnit}
                      </TableCell>
                      <TableCell className="text-xs py-1 font-mono">{ch.baseline}</TableCell>
                      <TableCell className="text-xs py-1 font-mono">
                        {ch.filterLowFrequency ? `${ch.filterLowFrequency} Hz` : '—'}
                      </TableCell>
                      <TableCell className="text-xs py-1 font-mono">
                        {ch.filterHighFrequency ? `${ch.filterHighFrequency} Hz` : '—'}
                      </TableCell>
                      <TableCell className="text-xs py-1 font-mono">
                        {ch.notchFilterFrequency ? `${ch.notchFilterFrequency} Hz` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function WaveformList({ waveforms }: { waveforms: Waveform[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Waveforms
          <Badge variant="secondary" className="ml-1">{waveforms.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {waveforms.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">No waveforms found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-xs">Idx</TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Originality</TableHead>
                <TableHead className="text-xs">Sampling Freq</TableHead>
                <TableHead className="text-xs">Channels</TableHead>
                <TableHead className="text-xs">Samples</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Bits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waveforms.map(w => (
                <WaveformRow key={w.index} waveform={w} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
