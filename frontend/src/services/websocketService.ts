/**
 * WebSocket Service for AI requests
 * Handles persistent WebSocket connection to backend for AI operations
 */

interface AIWSRequest {
  user_id: string;
  prompt: string;
  file_analysis?: {
    file_name: string;
    file_size: number;
    first_bytes: number[];
    entropy: number;
    patterns?: Array<{
      offset: number;
      bytes: number[];
      occurrences: number;
    }>;
    periodic_structures?: Array<{
      period: number;
      confidence: number;
    }>;
  };
}

interface AIWSResponse {
  success: boolean;
  data?: string;
  error?: string;
}

type MessageCallback = (response: AIWSResponse) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageCallbacks: Map<number, MessageCallback> = new Map();
  private messageId = 0;

  constructor() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : "localhost:3000";
    this.wsUrl = `${protocol}//${host}/ws/ai`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log("AI WebSocket connected");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error("AI WebSocket error:", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("AI WebSocket disconnected");
          this.handleReconnect();
        };

        this.ws.onmessage = (event) => {
          try {
            const response: AIWSResponse = JSON.parse(event.data);
            // For now, just call all callbacks (single request/response pattern)
            this.messageCallbacks.forEach((callback) => {
              callback(response);
            });
            this.messageCallbacks.clear();
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle WebSocket reconnection
   */
  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      setTimeout(() => {
        this.connect().catch((err) =>
          console.error("Reconnect failed:", err)
        );
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error("Max reconnect attempts reached");
    }
  }

  /**
   * Send AI request and wait for response
   */
  async sendRequest(request: AIWSRequest): Promise<AIWSResponse> {
    // Ensure connection
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const msgId = this.messageId++;
      const timeout = setTimeout(() => {
        this.messageCallbacks.delete(msgId);
        reject(new Error("Request timeout"));
      }, 120000); // 2 minutes timeout

      this.messageCallbacks.set(msgId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      try {
        this.ws!.send(JSON.stringify(request));
      } catch (err) {
        clearTimeout(timeout);
        this.messageCallbacks.delete(msgId);
        reject(err);
      }
    });
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const wsService = new WebSocketService();

// Auto-connect on import
wsService.connect().catch((err) => console.error("Initial WebSocket connection failed:", err));
