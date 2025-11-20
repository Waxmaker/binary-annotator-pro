const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface MCPServer {
  name: string;
  image: string;
  started: string;
  toolCount: number;
  running: boolean;
}

export interface MCPDockerStats {
  serverCount: number;
  totalTools: number;
  servers: MCPServer[];
  managerUrl: string;
}

export const mcpDockerApi = {
  // Get aggregated stats
  async getStats(): Promise<MCPDockerStats> {
    const response = await fetch(`${API_URL}/mcp/docker/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch MCP Docker stats');
    }
    return response.json();
  },

  // Get health status
  async getHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_URL}/mcp/docker/health`);
    if (!response.ok) {
      throw new Error('Failed to fetch MCP Docker health');
    }
    return response.json();
  },

  // Toggle server on/off
  async toggleServer(
    name: string,
    action: 'start' | 'stop',
    image?: string
  ): Promise<{ message: string; name: string }> {
    const body: any = { action };
    if (action === 'start' && image) {
      body.image = image;
    }

    const response = await fetch(`${API_URL}/mcp/docker/servers/${name}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle server');
    }

    return response.json();
  },

  // Start a server
  async startServer(name: string, image: string): Promise<{ message: string; name: string }> {
    const response = await fetch(`${API_URL}/mcp/docker/servers/${name}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start server');
    }

    return response.json();
  },

  // Stop a server
  async stopServer(name: string): Promise<{ message: string; name: string }> {
    const response = await fetch(`${API_URL}/mcp/docker/servers/${name}/stop`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to stop server');
    }

    return response.json();
  },

  // Call a tool on a server
  async callTool(
    serverName: string,
    tool: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    const response = await fetch(`${API_URL}/mcp/docker/servers/${serverName}/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool, arguments: args }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to call tool');
    }

    return response.json();
  },
};
