import type {
  AssetMeta,
  StorageAdapter,
  StorageMode,
  VectorMatch,
} from "./StorageAdapter";

interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  r2Bucket: string;
  d1DatabaseId: string;
  kvNamespaceId: string;
  vectorizeIndexName: string;
}

export class CloudflareStorageAdapter implements StorageAdapter {
  private cfg: CloudflareConfig;
  private baseUrl: string;

  constructor(cfg: CloudflareConfig) {
    this.cfg = cfg;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}`;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.cfg.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  // ── Assets (R2) ───────────────────────────────────────────────
  async uploadAsset(key: string, data: Buffer, contentType: string): Promise<string> {
    const url = `${this.baseUrl}/r2/buckets/${this.cfg.r2Bucket}/objects/${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.cfg.apiToken}`,
        "Content-Type": contentType,
      },
      body: data,
    });
    if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
    return `https://${this.cfg.r2Bucket}.r2.dev/${key}`;
  }

  async downloadAsset(key: string): Promise<Buffer> {
    const url = `${this.baseUrl}/r2/buckets/${this.cfg.r2Bucket}/objects/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`R2 download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async deleteAsset(key: string): Promise<void> {
    const url = `${this.baseUrl}/r2/buckets/${this.cfg.r2Bucket}/objects/${encodeURIComponent(key)}`;
    await fetch(url, { method: "DELETE", headers: this.headers() });
  }

  async listAssets(prefix = ""): Promise<AssetMeta[]> {
    const url = `${this.baseUrl}/r2/buckets/${this.cfg.r2Bucket}/objects${prefix ? `?prefix=${prefix}` : ""}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return [];
    const json = await res.json() as { result?: { objects?: { key: string; size: number; uploaded: string }[] } };
    return (json.result?.objects ?? []).map((o) => ({
      key: o.key,
      size: o.size,
      updatedAt: o.uploaded,
    }));
  }

  // ── Structured data (D1) ──────────────────────────────────────
  private async d1Query(sql: string, params: unknown[] = []) {
    const url = `${this.baseUrl}/d1/database/${this.cfg.d1DatabaseId}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) throw new Error(`D1 query failed: ${res.status}`);
    const json = await res.json() as { result?: { results?: unknown[] }[] };
    return json.result?.[0]?.results ?? [];
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const rows = await this.d1Query(
      "SELECT value FROM kv_store WHERE key = ?",
      [`${collection}:${id}`]
    ) as { value: string }[];
    if (!rows.length) return null;
    return JSON.parse(rows[0].value) as T;
  }

  async put<T>(collection: string, id: string, data: T): Promise<void> {
    await this.d1Query(
      "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
      [`${collection}:${id}`, JSON.stringify(data)]
    );
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.d1Query("DELETE FROM kv_store WHERE key = ?", [
      `${collection}:${id}`,
    ]);
  }

  async query<T>(collection: string, _filter?: Record<string, unknown>): Promise<T[]> {
    const rows = await this.d1Query(
      "SELECT value FROM kv_store WHERE key LIKE ?",
      [`${collection}:%`]
    ) as { value: string }[];
    return rows.map((r) => JSON.parse(r.value) as T);
  }

  // ── KV ───────────────────────────────────────────────────────
  async kvGet(key: string): Promise<string | null> {
    const url = `${this.baseUrl}/storage/kv/namespaces/${this.cfg.kvNamespaceId}/values/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
    return res.text();
  }

  async kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const url = `${this.baseUrl}/storage/kv/namespaces/${this.cfg.kvNamespaceId}/values/${encodeURIComponent(key)}${ttlSeconds ? `?expiration_ttl=${ttlSeconds}` : ""}`;
    await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.cfg.apiToken}`,
        "Content-Type": "text/plain",
      },
      body: value,
    });
  }

  async kvDelete(key: string): Promise<void> {
    const url = `${this.baseUrl}/storage/kv/namespaces/${this.cfg.kvNamespaceId}/values/${encodeURIComponent(key)}`;
    await fetch(url, { method: "DELETE", headers: this.headers() });
  }

  // ── Vectorize ─────────────────────────────────────────────────
  async vectorUpsert(
    id: string,
    vector: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const url = `${this.baseUrl}/vectorize/v2/indexes/${this.cfg.vectorizeIndexName}/upsert`;
    await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ vectors: [{ id, values: vector, metadata }] }),
    });
  }

  async vectorSearch(vector: number[], topK = 5): Promise<VectorMatch[]> {
    const url = `${this.baseUrl}/vectorize/v2/indexes/${this.cfg.vectorizeIndexName}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ vector, topK, returnMetadata: "all" }),
    });
    if (!res.ok) return [];
    const json = await res.json() as { result?: { matches?: { id: string; score: number; metadata?: Record<string, unknown> }[] } };
    return (json.result?.matches ?? []).map((m) => ({
      id: m.id,
      score: m.score,
      metadata: m.metadata,
    }));
  }

  // ── Health ────────────────────────────────────────────────────
  async ping(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/d1/database/${this.cfg.d1DatabaseId}`;
      const res = await fetch(url, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }

  getStorageMode(): StorageMode {
    return "cloudflare";
  }
}
