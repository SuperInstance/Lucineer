/**
 * Keys file — API keys stored encrypted in localStorage.
 * Encryption: AES-256-GCM with a key derived from a per-device salt via PBKDF2.
 * Keys are NEVER uploaded anywhere.
 */

export interface LucineerKeys {
  version: string;
  cloudflare?: {
    apiToken: string;
    accountId: string;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
  };
  ai?: {
    zai?: string;
    anthropic?: string;
    openai?: string;
    google?: string;
    mistral?: string;
    ollama?: string;
    custom?: Record<string, { baseUrl: string; apiKey: string }>;
  };
  community?: {
    hubApiKey?: string;
  };
}

const KEYS_STORAGE_KEY = "lucineer_keys_enc";
const SALT_KEY = "lucineer_device_salt";

function getOrCreateSalt(): string {
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(SALT_KEY, salt);
  }
  return salt;
}

async function deriveKey(salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(salt),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("lucineer-keys"),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encoded: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

export async function saveKeys(keys: LucineerKeys): Promise<void> {
  const salt = getOrCreateSalt();
  const key = await deriveKey(salt);
  const encrypted = await encrypt(JSON.stringify(keys), key);
  localStorage.setItem(KEYS_STORAGE_KEY, encrypted);
}

export async function loadKeys(): Promise<LucineerKeys | null> {
  const stored = localStorage.getItem(KEYS_STORAGE_KEY);
  if (!stored) return null;
  try {
    const salt = getOrCreateSalt();
    const key = await deriveKey(salt);
    const plaintext = await decrypt(stored, key);
    return JSON.parse(plaintext) as LucineerKeys;
  } catch {
    return null;
  }
}

export async function clearKeys(): Promise<void> {
  localStorage.removeItem(KEYS_STORAGE_KEY);
}
