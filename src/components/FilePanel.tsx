import { useCallback } from 'react';
import { Upload, File, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { generateSampleECG, downloadSampleECG } from '@/utils/generateSampleECG';
import { toast } from 'sonner';

interface FilePanelProps {
  files: Array<{ name: string; size: number; buffer: ArrayBuffer }>;
  currentFile: string | null;
  onFileSelect: (fileName: string) => void;
  onFileAdd: (file: File, buffer: ArrayBuffer) => void;
  onFileRemove: (fileName: string) => void;
}

export function FilePanel({
  files,
  currentFile,
  onFileSelect,
  onFileAdd,
  onFileRemove,
}: FilePanelProps) {
  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      onFileAdd(file, buffer);
      e.target.value = '';
    },
    [onFileAdd]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      onFileAdd(file, buffer);
    },
    [onFileAdd]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleLoadSample = useCallback(() => {
    const buffer = generateSampleECG();
    // Pass buffer directly, FilePanel will handle it
    const mockFile = {
      name: 'sample_ecg.dat',
      arrayBuffer: async () => buffer,
    } as File;
    onFileAdd(mockFile, buffer);
    toast.success('Sample ECG file loaded - 40KB demo file with 12-lead data');
  }, [onFileAdd]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">Binary Files</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {files.length === 0 && (
          <>
            <Card
              className="border-2 border-dashed border-muted hover:border-primary transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drop binary file here
                </p>
                <p className="text-xs text-muted-foreground mb-4">or</p>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileInput}
                      accept="*/*"
                    />
                    Browse Files
                  </label>
                </Button>
              </div>
            </Card>
            
            <Card className="p-4 bg-accent/10 border-accent/30">
              <p className="text-xs text-muted-foreground mb-3">
                No files loaded. Load a sample ECG file to get started:
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={handleLoadSample}
              >
                <Download className="h-3 w-3 mr-2" />
                Load Sample ECG
              </Button>
            </Card>
          </>
        )}

        {files.map((file) => (
          <Card
            key={file.name}
            className={`p-3 cursor-pointer transition-colors ${
              currentFile === file.name
                ? 'bg-primary/20 border-primary'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onFileSelect(file.name)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <File className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemove(file.name);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        ))}

        {files.length > 0 && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <label className="cursor-pointer">
              <input
                type="file"
                className="hidden"
                onChange={handleFileInput}
                accept="*/*"
              />
              <Upload className="h-4 w-4 mr-2" />
              Add Another File
            </label>
          </Button>
        )}
      </div>
    </div>
  );
}
