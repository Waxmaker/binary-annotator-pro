import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileCode, Trash2, Download } from "lucide-react";
import {
  fetchYamlList,
  fetchYamlConfig,
  deleteYamlConfig,
  YamlConfigItem,
} from "@/lib/api";

interface YamlConfigListProps {
  onLoadConfig: (name: string, yaml: string) => void;
  onRefresh?: () => void;
}

export function YamlConfigList({
  onLoadConfig,
  onRefresh,
}: YamlConfigListProps) {
  const [configs, setConfigs] = useState<YamlConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const list = await fetchYamlList();
      setConfigs(list);
    } catch (err: any) {
      console.error("Failed to load YAML configs:", err);
      toast.error(`Failed to load configs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleLoadConfig = async (name: string) => {
    try {
      const yaml = await fetchYamlConfig(name);
      onLoadConfig(name, yaml);
      toast.success(`Loaded config: ${name}`);
    } catch (err: any) {
      console.error("Failed to load config:", err);
      toast.error(`Failed to load config: ${err.message}`);
    }
  };

  const handleDeleteClick = (name: string) => {
    setConfigToDelete(name);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!configToDelete) return;

    try {
      await deleteYamlConfig(configToDelete);
      toast.success(`Deleted config: ${configToDelete}`);
      setConfigs((prev) => prev.filter((c) => c.name !== configToDelete));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Failed to delete config:", err);
      toast.error(`Failed to delete config: ${err.message}`);
    } finally {
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border bg-panel-header">
        <h2 className="text-sm font-semibold text-foreground">
          Saved Configurations
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading configurations...
            </div>
          ) : configs.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No saved configurations
            </div>
          ) : (
            configs.map((config) => (
              <div
                key={config.id}
                className="group flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {config.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(config.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleLoadConfig(config.name)}
                    title="Load configuration"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(config.name)}
                    title="Delete configuration"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the configuration "
              {configToDelete}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
