import { useCallback, useState } from "react";
import { Upload, File, X, Download, Loader2, Edit2, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadBinaryFile, renameBinaryFile } from "@/lib/api";
import { generateSampleECG } from "@/utils/generateSampleECG";

interface FilePanelProps {
  files: Array<{ name: string; size: number; buffer: ArrayBuffer }>;
  currentFile: string | null;
  onFileSelect: (fileName: string) => void;
  onFileAdd: (file: File, buffer: ArrayBuffer) => void;
  onFileRemove: (fileName: string) => void;
  onFileRename: (oldName: string, newName: string) => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}

export function FilePanel({
  files,
  currentFile,
  onFileSelect,
  onFileAdd,
  onFileRemove,
  onFileRename,
  isLoading = false,
  isDeleting = false,
}: FilePanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState<string>("");
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRenameStart = (fileName: string) => {
    setRenamingFile(fileName);
    setNewFileName(fileName);
  };

  const handleRenameCancel = () => {
    setRenamingFile(null);
    setNewFileName("");
  };

  const handleRenameConfirm = async (oldName: string) => {
    if (!newFileName.trim() || newFileName === oldName) {
      handleRenameCancel();
      return;
    }

    setIsRenaming(true);
    const loadingToast = toast.loading(`Renaming ${oldName}...`);

    try {
      await renameBinaryFile(oldName, newFileName);

      // Update parent state via callback
      onFileRename(oldName, newFileName);

      toast.success(`Renamed to "${newFileName}"`, { id: loadingToast });
      handleRenameCancel();
    } catch (err: any) {
      toast.error(`Rename failed: ${err.message}`, { id: loadingToast });
    } finally {
      setIsRenaming(false);
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadingFileName(file.name);
      setUploadProgress(0);

      const loadingToast = toast.loading(`Uploading ${file.name}...`);

      try {
        // Simulate progress for upload
        setUploadProgress(30);

        // 1️⃣ Send to backend
        await uploadBinaryFile(file);
        setUploadProgress(60);

        // 2️⃣ Load in-memory buffer
        const buffer = await file.arrayBuffer();
        setUploadProgress(90);

        // 3️⃣ Inject into app state (HexViewer)
        onFileAdd(file, buffer);
        setUploadProgress(100);

        toast.success(`Uploaded ${file.name}`, { id: loadingToast });
      } catch (err: any) {
        toast.error(`Upload failed: ${err.message}`, { id: loadingToast });
        console.error(err);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadingFileName("");
      }
    },
    [onFileAdd],
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      await processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      await processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleLoadSample = useCallback(() => {
    const buffer = generateSampleECG();
    const mockFile = {
      name: "sample_ecg.dat",
      arrayBuffer: async () => buffer,
    } as File;

    onFileAdd(mockFile, buffer);
    toast.success("Sample ECG loaded (40 KB 12-lead dataset)");
  }, [onFileAdd]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">Binary Files</h2>
      </div>

      {/* Upload Progress Overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-6 w-80 shadow-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Uploading file...</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {uploadingFileName}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {uploadProgress}%
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {isLoading && (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading binary files...</p>
          </Card>
        )}

        {!isLoading && files.length === 0 && (
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
                <Button variant="outline" size="sm" asChild disabled={isUploading}>
                  <label className={isUploading ? "cursor-not-allowed" : "cursor-pointer"}>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileInput}
                      accept="*/*"
                      disabled={isUploading}
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
                disabled={isUploading}
              >
                <Download className="h-3 w-3 mr-2" />
                Load Sample ECG
              </Button>
            </Card>
          </>
        )}

        {!isLoading && files.map((file) => (
          <Card
            key={file.name}
            className={`p-3 transition-colors ${
              renamingFile === file.name
                ? "bg-accent/20 border-accent"
                : currentFile === file.name
                ? "bg-primary/20 border-primary"
                : "hover:bg-muted/50 cursor-pointer"
            } ${isDeleting || isRenaming ? "opacity-50 pointer-events-none" : ""}`}
            onClick={() => !isDeleting && !isRenaming && renamingFile !== file.name && onFileSelect(file.name)}
          >
            {renamingFile === file.name ? (
              // Rename mode
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 flex-shrink-0 text-primary" />
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameConfirm(file.name);
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                  className="h-7 text-sm flex-1"
                  autoFocus
                  disabled={isRenaming}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400"
                  onClick={() => handleRenameConfirm(file.name)}
                  disabled={isRenaming}
                >
                  {isRenaming ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                  onClick={handleRenameCancel}
                  disabled={isRenaming}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              // Normal mode
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameStart(file.name);
                    }}
                    disabled={isDeleting}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileRemove(file.name);
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}

        {files.length > 0 && (
          <Button variant="outline" size="sm" className="w-full" asChild disabled={isUploading}>
            <label className={isUploading ? "cursor-not-allowed" : "cursor-pointer"}>
              <input
                type="file"
                className="hidden"
                onChange={handleFileInput}
                accept="*/*"
                disabled={isUploading}
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
