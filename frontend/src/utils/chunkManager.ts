// ChunkManager: Loads binary files in chunks on-demand to reduce memory usage

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAX_CACHED_CHUNKS = 20; // Keep max 20 chunks in cache (~20MB)

interface Chunk {
  start: number;
  end: number;
  data: Uint8Array;
  lastAccessed: number;
}

interface FileChunks {
  [fileKey: string]: {
    fileId?: number; // Database ID for API calls
    fileName?: string; // Filename for legacy mode
    size: number;
    chunks: Map<string, Chunk>;
  };
}

class ChunkManager {
  private files: FileChunks = {};
  private apiUrl: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || import.meta.env.VITE_API_URL || "http://localhost:3000";
  }

  // Initialize file metadata (size only, no data)
  // Use fileId for API-based loading (preferred for large files)
  initFile(fileKeyOrName: string, size: number, fileId?: number) {
    if (!this.files[fileKeyOrName]) {
      this.files[fileKeyOrName] = {
        fileId,
        fileName: !fileId ? fileKeyOrName : undefined,
        size,
        chunks: new Map(),
      };
    }
  }

  // Get chunk key
  private getChunkKey(start: number, end: number): string {
    return `${start}-${end}`;
  }

  // Load a chunk from the server
  // Uses new /binary/:id/chunk endpoint when fileId is available
  // Falls back to Range request with filename for legacy mode
  private async loadChunk(fileKey: string, start: number, length: number): Promise<Uint8Array> {
    const file = this.files[fileKey];
    if (!file) {
      throw new Error(`File ${fileKey} not initialized`);
    }

    if (file.fileId) {
      // Use new chunk endpoint (preferred - more efficient)
      const response = await fetch(
        `${this.apiUrl}/binary/${file.fileId}/chunk?offset=${start}&length=${length}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Failed to load chunk: ${response.statusText}`);
      }

      const json = await response.json();
      // Decode base64 data from Go backend
      const binaryString = atob(json.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      // Legacy mode: Use Range header with filename
      const end = start + length - 1;
      const response = await fetch(`${this.apiUrl}/get/binary/${file.fileName}`, {
        headers: {
          Range: `bytes=${start}-${end}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load chunk: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  }

  // Get bytes from offset with given length (loads chunks as needed)
  async getBytes(fileKey: string, offset: number, length: number): Promise<Uint8Array> {
    const file = this.files[fileKey];
    if (!file) {
      throw new Error(`File ${fileKey} not initialized`);
    }

    // Calculate chunk boundaries
    const chunkStart = Math.floor(offset / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkLength = Math.min(CHUNK_SIZE, file.size - chunkStart);

    const chunkKey = this.getChunkKey(chunkStart, chunkStart + chunkLength);

    // Check if chunk is already in cache
    let chunk = file.chunks.get(chunkKey);

    if (!chunk) {
      // Load chunk from server
      console.log(`Loading chunk ${chunkKey} for ${fileKey}`);
      const data = await this.loadChunk(fileKey, chunkStart, chunkLength);

      chunk = {
        start: chunkStart,
        end: chunkStart + data.byteLength - 1,
        data,
        lastAccessed: Date.now(),
      };

      file.chunks.set(chunkKey, chunk);

      // Evict old chunks if cache is too large
      this.evictOldChunks(fileKey);
    } else {
      // Update last accessed time
      chunk.lastAccessed = Date.now();
    }

    // Extract the requested bytes from the chunk
    const localStart = offset - chunk.start;
    const localEnd = Math.min(localStart + length, chunk.data.byteLength);

    return chunk.data.slice(localStart, localEnd);
  }

  // Evict least recently used chunks
  private evictOldChunks(fileKey: string) {
    const file = this.files[fileKey];
    if (!file) return;

    const chunks = Array.from(file.chunks.entries());

    if (chunks.length > MAX_CACHED_CHUNKS) {
      // Sort by last accessed time
      chunks.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      // Remove oldest chunks
      const toRemove = chunks.length - MAX_CACHED_CHUNKS;
      for (let i = 0; i < toRemove; i++) {
        file.chunks.delete(chunks[i][0]);
        console.log(`Evicted chunk ${chunks[i][0]} from cache`);
      }
    }
  }

  // Preload chunks around a given offset (for smoother scrolling)
  async preloadAround(fileKey: string, offset: number, radius: number = CHUNK_SIZE * 2) {
    const file = this.files[fileKey];
    if (!file) return;

    const startOffset = Math.max(0, offset - radius);
    const endOffset = Math.min(file.size - 1, offset + radius);

    // Load chunks in this range
    const promises: Promise<void>[] = [];
    for (let start = Math.floor(startOffset / CHUNK_SIZE) * CHUNK_SIZE;
         start <= endOffset;
         start += CHUNK_SIZE) {
      const length = Math.min(CHUNK_SIZE, file.size - start);
      const chunkKey = this.getChunkKey(start, start + length);

      if (!file.chunks.has(chunkKey)) {
        promises.push(
          this.getBytes(fileKey, start, length)
            .then(() => {})
            .catch(err => console.error(`Preload failed for chunk ${chunkKey}:`, err))
        );
      }
    }

    await Promise.all(promises);
  }

  // Clear all chunks for a file
  clearFile(fileKey: string) {
    if (this.files[fileKey]) {
      this.files[fileKey].chunks.clear();
      delete this.files[fileKey];
    }
  }

  // Get memory usage statistics
  getMemoryStats() {
    let totalChunks = 0;
    let totalBytes = 0;

    Object.values(this.files).forEach(file => {
      file.chunks.forEach(chunk => {
        totalChunks++;
        totalBytes += chunk.data.byteLength;
      });
    });

    return {
      totalChunks,
      totalBytes,
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    };
  }
}

// Global singleton instance
export const chunkManager = new ChunkManager();
