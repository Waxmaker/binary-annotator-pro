import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileCode, Download } from 'lucide-react';
import { YamlConfig } from '@/utils/yamlParser';
import { generateKaitaiTemplate, downloadKaitaiTemplate } from '@/utils/kaitaiHelper';
import { toast } from 'sonner';

interface KaitaiGeneratorProps {
  config: YamlConfig | null;
  fileName: string | null;
}

export function KaitaiGenerator({ config, fileName }: KaitaiGeneratorProps) {
  const handleGenerateKaitai = () => {
    const ksy = generateKaitaiTemplate(config, fileName || 'ecg_format');
    
    // Show preview in toast
    toast.success('Kaitai template generated', {
      description: 'Click download to save the .ksy file',
    });
    
    // Auto-download
    downloadKaitaiTemplate(ksy, `${fileName || 'format'}.ksy`);
  };

  return (
    <Card className="p-4 space-y-3 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <div className="flex items-center gap-2">
        <FileCode className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Kaitai Struct Helper</h3>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Generate a Kaitai Struct (.ksy) template from your current tag configuration.
        Perfect for creating formal parsers!
      </p>

      <Button
        size="sm"
        onClick={handleGenerateKaitai}
        disabled={!config}
        className="w-full"
      >
        <Download className="h-3 w-3 mr-2" />
        Generate KSY Template
      </Button>

      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
        <p className="font-semibold">What is Kaitai Struct?</p>
        <p>
          A declarative language for describing binary data structures.
          Use it to generate parsers in multiple languages (Python, C++, Java, Go, etc.)
        </p>
        <a
          href="https://kaitai.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline block mt-1"
        >
          Learn more at kaitai.io →
        </a>
      </div>
    </Card>
  );
}
