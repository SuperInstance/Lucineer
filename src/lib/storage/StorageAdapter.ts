export interface AssetMeta {
  key: string;
  size: number;
  updatedAt: string;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export type StorageMode = "local" | "cloudflare";

export interface StorageAdapter {
  // ── Assets (images, audio, 3D models) ─────────────────────────
  uploadAsset(key: string, data: Buffer, contentType: string): Promise<string>;
  downloadAsset(key: string): Promise<Buffer>;
  deleteAsset(key: string): Promise<void>;
  listAssets(prefix?: string): Promise<AssetMeta[]>;

  // ── Structured data (progress, designs, game state) ───────────
  get<T>(collection: string, id: string): Promise<T | null>;
  put<T>(collection: string, id: string, data: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  query<T>(collection: string, filter?: Record<string, unknown>): Promise<T[]>;

  // ── Key-value (settings, session cache) ───────────────────────
  kvGet(key: string): Promise<string | null>;
  kvSet(key: string, value: string, ttlSeconds?: number): Promise<void>;
  kvDelete(key: string): Promise<void>;

  // ── Vector search (AI retrieval, personalisation) ─────────────
  vectorUpsert(
    id: string,
    vector: number[],
    metadata?: Record<string, unknown>
  ): Promise<void>;
  vectorSearch(vector: number[], topK?: number): Promise<VectorMatch[]>;

  // ── Health ────────────────────────────────────────────────────
  ping(): Promise<boolean>;
  getStorageMode(): StorageMode;
}
