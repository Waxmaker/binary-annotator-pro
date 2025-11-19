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
  [fileName: string]: {
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
  initFile(fileName: string, size: number) {
    if (!this.files[fileName]) {
      this.files[fileName] = {
        size,
        chunks: new Map(),
      };
    }
  }

  // Get chunk key
  private getChunkKey(start: number, end: number): string {
    return `${start}-${end}`;
  }

  // Load a chunk from the server using HTTP range request
  private async loadChunk(fileName: string, start: number, end: number): Promise<Uint8Array> {
    const response = await fetch(`${this.apiUrl}/get/binary/${fileName}`, {
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

  // Get bytes from offset with given length (loads chunks as needed)
  async getBytes(fileName: string, offset: number, length: number): Promise<Uint8Array> {
    const file = this.files[fileName];
    if (!file) {
      throw new Error(`File ${fileName} not initialized`);
    }

    // Calculate chunk boundaries
    const chunkStart = Math.floor(offset / CHUNK_SIZE) * CHUNK_SIZE;
    const chunkEnd = Math.min(
      Math.ceil((offset + length) / CHUNK_SIZE) * CHUNK_SIZE - 1,
      file.size - 1
    );

    const chunkKey = this.getChunkKey(chunkStart, chunkEnd);

    // Check if chunk is already in cache
    let chunk = file.chunks.get(chunkKey);

    if (!chunk) {
      // Load chunk from server
      console.log(`Loading chunk ${chunkKey} for ${fileName}`);
      const data = await this.loadChunk(fileName, chunkStart, chunkEnd);

      chunk = {
        start: chunkStart,
        end: chunkEnd,
        data,
        lastAccessed: Date.now(),
      };

      file.chunks.set(chunkKey, chunk);

      // Evict old chunks if cache is too large
      this.evictOldChunks(fileName);
    } else {
      // Update last accessed time
      chunk.lastAccessed = Date.now();
    }

    // Extract the requested bytes from the chunk
    const localStart = offset - chunk.start;
    const localEnd = localStart + length;

    return chunk.data.slice(localStart, localEnd);
  }

  // Evict least recently used chunks
  private evictOldChunks(fileName: string) {
    const file = this.files[fileName];
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
  async preloadAround(fileName: string, offset: number, radius: number = CHUNK_SIZE * 2) {
    const file = this.files[fileName];
    if (!file) return;

    const startOffset = Math.max(0, offset - radius);
    const endOffset = Math.min(file.size - 1, offset + radius);

    // Load chunks in this range
    const promises: Promise<void>[] = [];
    for (let start = Math.floor(startOffset / CHUNK_SIZE) * CHUNK_SIZE;
         start <= endOffset;
         start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, file.size - 1);
      const chunkKey = this.getChunkKey(start, end);

      if (!file.chunks.has(chunkKey)) {
        promises.push(
          this.getBytes(fileName, start, end - start + 1)
            .then(() => {})
            .catch(err => console.error(`Preload failed for chunk ${chunkKey}:`, err))
        );
      }
    }

    await Promise.all(promises);
  }

  // Clear all chunks for a file
  clearFile(fileName: string) {
    if (this.files[fileName]) {
      this.files[fileName].chunks.clear();
      delete this.files[fileName];
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
