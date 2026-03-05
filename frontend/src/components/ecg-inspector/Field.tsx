interface FieldProps {
  label: string
  value: string | number | undefined
  mono?: boolean
}

export function Field({ label, value, mono }: FieldProps) {
  const empty = value === undefined || value === '' || value === 0
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${empty ? 'text-muted-foreground italic' : 'text-foreground'}`}>
        {empty ? '—' : String(value)}
      </span>
    </div>
  )
}
