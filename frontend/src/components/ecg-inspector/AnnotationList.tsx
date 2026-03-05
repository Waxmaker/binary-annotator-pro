import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tag } from 'lucide-react'
import type { Annotation } from './types'

export function AnnotationList({ annotations }: { annotations: Annotation[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          Annotations
          <Badge variant="secondary" className="ml-1">{annotations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {annotations.length === 0 ? (
          <p className="text-sm text-muted-foreground px-6 py-4">No annotations found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Concept</TableHead>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">System</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs">Unit</TableHead>
                <TableHead className="text-xs">Text</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annotations.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{a.conceptName || '—'}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {a.code ? <Badge variant="outline" className="text-xs">{a.code}</Badge> : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.codeSystem || '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{a.numericValue || '—'}</TableCell>
                  <TableCell className="text-xs">{a.unit || '—'}</TableCell>
                  <TableCell className="text-xs">{a.textValue || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
