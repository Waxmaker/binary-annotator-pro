import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

export function YamlEditor({ value, onChange, error }: YamlEditorProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">YAML Configuration</h2>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {error ? (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : (
          <Alert className="flex-shrink-0 border-accent bg-accent/10">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <AlertDescription className="text-xs text-accent-foreground">
              YAML configuration is valid
            </AlertDescription>
          </Alert>
        )}

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs resize-none bg-hex-background border-border"
          placeholder="Enter YAML configuration..."
          spellCheck={false}
        />

        <div className="flex-shrink-0 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold">Configuration Format:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>
              <code className="text-primary">search:</code> Define text patterns to highlight
            </li>
            <li>
              <code className="text-primary">tags:</code> Define offset-based regions
            </li>
            <li>Colors in hex format (e.g., <code className="text-primary">#FF0000</code>)</li>
            <li>Offsets support hex (e.g., <code className="text-primary">0x1000</code>)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
