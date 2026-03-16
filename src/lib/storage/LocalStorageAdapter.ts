import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type {
  AssetMeta,
  StorageAdapter,
  StorageMode,
  VectorMatch,
} from "./StorageAdapter";

const DATA_DIR = process.env.LUCINEER_DATA_PATH ?? path.join(process.cwd(), ".lucineer");
const ASSETS_DIR = path.join(DATA_DIR, "assets");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export class LocalStorageAdapter implements StorageAdapter {
  // ── Assets ───────────────────────────────────────────────────
  async uploadAsset(key: string, data: Buffer, _contentType: string): Promise<string> {
    const filePath = path.join(ASSETS_DIR, key);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, data);
    return `/api/assets/${encodeURIComponent(key)}`;
  }

  async downloadAsset(key: string): Promise<Buffer> {
    const filePath = path.join(ASSETS_DIR, key);
    return fs.readFile(filePath);
  }

  async deleteAsset(key: string): Promise<void> {
    const filePath = path.join(ASSETS_DIR, key);
    await fs.unlink(filePath).catch(() => {});
  }

  async listAssets(prefix = ""): Promise<AssetMeta[]> {
    await ensureDir(ASSETS_DIR);
    const entries = await fs.readdir(ASSETS_DIR, { withFileTypes: true });
    const result: AssetMeta[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (prefix && !entry.name.startsWith(prefix)) continue;
      const stat = await fs.stat(path.join(ASSETS_DIR, entry.name));
      result.push({
        key: entry.name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }
    return result;
  }

  // ── Structured data — delegated to Prisma/SQLite ─────────────
  // Uses a generic KeyValueStore model; collections map to a namespace prefix.
  async get<T>(collection: string, id: string): Promise<T | null> {
    const record = await (prisma as any).keyValueStore?.findUnique?.({
      where: { key: `${collection}:${id}` },
    });
    if (!record) return null;
    return JSON.parse(record.value) as T;
  }

  async put<T>(collection: string, id: string, data: T): Promise<void> {
    const key = `${collection}:${id}`;
    const value = JSON.stringify(data);
    await (prisma as any).keyValueStore?.upsert?.({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async delete(collection: string, id: string): Promise<void> {
    await (prisma as any).keyValueStore?.delete?.({
      where: { key: `${collection}:${id}` },
    }).catch(() => {});
  }

  async query<T>(collection: string, _filter?: Record<string, unknown>): Promise<T[]> {
    const records = await (prisma as any).keyValueStore?.findMany?.({
      where: { key: { startsWith: `${collection}:` } },
    }) ?? [];
    return records.map((r: { value: string }) => JSON.parse(r.value) as T);
  }

  // ── KV ───────────────────────────────────────────────────────
  async kvGet(key: string): Promise<string | null> {
    const record = await (prisma as any).keyValueStore?.findUnique?.({
      where: { key: `kv:${key}` },
    });
    if (!record) return null;
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      await this.kvDelete(key);
      return null;
    }
    return record.value;
  }

  async kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const k = `kv:${key}`;
    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
      : null;
    await (prisma as any).keyValueStore?.upsert?.({
      where: { key: k },
      create: { key: k, value, expiresAt },
      update: { value, expiresAt },
    });
  }

  async kvDelete(key: string): Promise<void> {
    await (prisma as any).keyValueStore?.delete?.({
      where: { key: `kv:${key}` },
    }).catch(() => {});
  }

  // ── Vector search — in-memory cosine similarity ───────────────
  async vectorUpsert(
    id: string,
    vector: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.put("vectors", id, { id, vector, metadata });
  }

  async vectorSearch(query: number[], topK = 5): Promise<VectorMatch[]> {
    const all = await this.query<{ id: string; vector: number[]; metadata?: Record<string, unknown> }>("vectors");
    const scored = all.map((item) => ({
      id: item.id,
      score: cosine(query, item.vector),
      metadata: item.metadata,
    }));
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // ── Health ────────────────────────────────────────────────────
  async ping(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  getStorageMode(): StorageMode {
    return "local";
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
