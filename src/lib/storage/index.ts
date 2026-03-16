import type { StorageAdapter } from "./StorageAdapter";
import { LocalStorageAdapter } from "./LocalStorageAdapter";

let _adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (_adapter) return _adapter;
  _adapter = new LocalStorageAdapter();
  return _adapter;
}

export function setStorageAdapter(adapter: StorageAdapter) {
  _adapter = adapter;
}

export type { StorageAdapter, StorageMode, AssetMeta, VectorMatch } from "./StorageAdapter";
export { LocalStorageAdapter } from "./LocalStorageAdapter";
export { CloudflareStorageAdapter } from "./CloudflareStorageAdapter";
