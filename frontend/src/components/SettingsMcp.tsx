import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Info,
  Server,
  Wrench,
  Container
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mcpDockerApi } from "@/services/mcpDockerApi";
import { useQuery } from "@tanstack/react-query";

interface SettingsMcpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Docker server configurations
const DOCKER_SERVER_CONFIGS = {
  "binary-tools": {
    image: "mcp/binary-tools:latest",
    displayName: "Binary Annotator Tools",
    description: "17 tools for ECG binary file analysis",
  },
  filesystem: {
    image: "mcp/filesystem:latest",
    displayName: "Filesystem Access",
    description: "Secure filesystem access",
  },
};

export function SettingsMcp({
  open,
  onOpenChange,
}: SettingsMcpProps) {
  const [togglingDocker, setTogglingDocker] = useState<Set<string>>(new Set());

  // Fetch Docker MCP stats
  const {
    data: dockerStats,
    isLoading: dockerLoading,
    refetch: refetchDocker
  } = useQuery({
    queryKey: ["mcp-docker-stats"],
    queryFn: mcpDockerApi.getStats,
    refetchInterval: 5000,
    enabled: open, // Only fetch when dialog is open
  });

  const toggleDockerServer = async (serverName: string, currentlyRunning: boolean) => {
    const config = DOCKER_SERVER_CONFIGS[serverName as keyof typeof DOCKER_SERVER_CONFIGS];
    if (!config) return;

    setTogglingDocker(prev => new Set(prev).add(serverName));

    try {
      const action = currentlyRunning ? "stop" : "start";
      await mcpDockerApi.toggleServer(serverName, action, config.image);

      toast.success(
        `${config.displayName} ${currentlyRunning ? 'stopped' : 'started'}`,
        {
          description: currentlyRunning
            ? 'Docker server has been stopped'
            : 'Docker server is now running',
        }
      );

      refetchDocker();
    } catch (err: any) {
      toast.error("Docker Server Error", {
        description: err.message || "Failed to change server state",
      });
    } finally {
      setTogglingDocker(prev => {
        const next = new Set(prev);
        next.delete(serverName);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10">
              <Container className="h-6 w-6 text-primary" />
            </div>
            Docker MCP Server Management
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Manage containerized Model Context Protocol servers
          </DialogDescription>
        </DialogHeader>

        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-3 py-4">
          <Card className="p-4 bg-blue-500/10 border-blue-500/20">
            <div className="flex items-center gap-3">
              <Container className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{dockerStats?.serverCount || 0}</p>
                <p className="text-xs text-muted-foreground">Running Containers</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-green-500/10 border-green-500/20">
            <div className="flex items-center gap-3">
              <Wrench className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{dockerStats?.totalTools || 0}</p>
                <p className="text-xs text-muted-foreground">Available Tools</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Docker Servers List */}
        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Available Servers
            </h3>
            {dockerLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {Object.entries(DOCKER_SERVER_CONFIGS).map(([serverName, config]) => {
            const runningServer = dockerStats?.servers.find(s => s.name === serverName);
            const isRunning = !!runningServer;
            const isToggling = togglingDocker.has(serverName);

            return (
              <Card
                key={serverName}
                className={`p-4 transition-all ${
                  isRunning
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Server Info */}
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <Container className={`h-5 w-5 ${isRunning ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-base">{config.displayName}</h4>

                        <Badge
                          variant={isRunning ? "default" : "outline"}
                          className="text-xs"
                        >
                          {isRunning ? "Running" : "Stopped"}
                        </Badge>

                        {isRunning && runningServer && (
                          <Badge variant="outline" className="text-xs">
                            {runningServer.toolCount} tool{runningServer.toolCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        {config.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Server className="h-3 w-3" />
                          <span>{config.image}</span>
                        </div>

                        {isRunning && runningServer && (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            {isToggling && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            <Switch
                              checked={isRunning}
                              onCheckedChange={() => toggleDockerServer(serverName, isRunning)}
                              disabled={isToggling}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isRunning ? "Stop Docker server" : "Start Docker server"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="pt-4 border-t">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Note:</strong> MCP servers run in isolated Docker containers. Toggle them on/off as needed.
              Each server provides specialized tools for binary analysis and file operations.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
