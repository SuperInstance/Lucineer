# Schema 05 — BYOC: Bring Your Own Cloudflare
## Lucineer · Open Source, Privacy-First Architecture

---

## Philosophy

> **Your data is yours. Always.**

Lucineer is open source. Users can self-host the entire stack, connect their own Cloudflare account for free cloud storage and compute, or run fully offline with local files. There is no central "Lucineer server" that holds user data. Community sharing is always opt-in, anonymous by default, and federated — you can run your own community hub.

```
Three modes, chosen by the user:

┌─────────────────────────────────────────────────────────┐
│  MODE A: Local-Only                                     │
│  All data lives on your machine.                        │
│  No internet required after install.                    │
│  API keys stored in a local JSON file.                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  MODE B: Bring Your Own Cloudflare (BYOC)               │
│  Connect your FREE Cloudflare account.                  │
│  Your data goes to your R2/D1/KV/Vectorize.             │
│  Lucineer never touches your data.                      │
│  Workers run in YOUR account — not ours.                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  MODE C: Community (opt-in layer on top of A or B)      │
│  Publish lessons/assets/adventures to a community hub.  │
│  Browse and download what others shared.                │
│  Can be official hub (lucineer.com) or self-hosted.     │
│  Your local/BYOC data never goes to community unless    │
│  you explicitly publish it.                             │
└─────────────────────────────────────────────────────────┘
```

---

## 1. File Structure

```
src/
├── app/
│   ├── settings/
│   │   ├── page.tsx                      ← Settings hub
│   │   ├── storage/page.tsx              ← Storage mode selection
│   │   ├── api-keys/page.tsx             ← API key management
│   │   └── community/page.tsx            ← Community hub settings
│   └── api/
│       ├── byoc/
│       │   ├── cloudflare-auth/route.ts  ← CF OAuth / token validation
│       │   ├── cf-setup/route.ts         ← Provision R2/D1/KV/Vectorize
│       │   └── cf-test/route.ts          ← Test connectivity
│       ├── storage/
│       │   ├── assets/route.ts           ← Read/write assets (routes to R2 or local)
│       │   └── progress/route.ts         ← Read/write progress (routes to D1 or SQLite)
│       └── community/
│           ├── publish/route.ts          ← Publish a pack to hub
│           ├── browse/route.ts           ← Browse community packs
│           └── download/route.ts         ← Download a pack
├── lib/
│   ├── storage/
│   │   ├── StorageAdapter.ts             ← Interface (implemented by Local/CF adapters)
│   │   ├── LocalStorageAdapter.ts        ← Reads/writes local filesystem
│   │   ├── CloudflareStorageAdapter.ts   ← Reads/writes via CF APIs
│   │   └── StorageAdapterFactory.ts      ← Returns correct adapter based on config
│   ├── config/
│   │   ├── LucineerConfig.ts             ← Config schema + validation
│   │   ├── ConfigLoader.ts               ← Loads from file or env
│   │   └── ConfigWriter.ts              ← Saves config changes
│   ├── keys/
│   │   ├── KeyVault.ts                   ← Reads/writes API keys (local JSON or env)
│   │   └── KeyEncryption.ts             ← AES-256 key encryption for stored keys
│   └── community/
│       ├── PackSchema.ts                 ← Community content schema
│       ├── PackPublisher.ts              ← Uploads pack to hub
│       └── PackRegistry.ts              ← Browses/downloads from hub
├── components/
│   └── settings/
│       ├── StorageModeSelector.tsx       ← Mode A/B/C picker UI
│       ├── CloudflareConnect.tsx         ← CF API key / OAuth flow
│       ├── LocalPathConfig.tsx           ← Set local data path
│       ├── ApiKeyManager.tsx             ← Manage AI API keys
│       └── CommunityHubConfig.tsx        ← Connect to hub
└── hooks/
    ├── useConfig.ts
    ├── useStorage.ts
    └── useCommunity.ts
```

---

## 2. Master Config Schema (`lucineer.config.json`)

This file lives at:
- **Installed (local mode):** `~/.lucineer/config.json`
- **Project (dev mode):** `./lucineer.config.json` (gitignored)
- **Docker:** `/app/data/config.json` (mounted volume)
- **Cloudflare Pages:** Environment variable `LUCINEER_CONFIG` (JSON-encoded)

```typescript
// src/lib/config/LucineerConfig.ts

export interface LucineerConfig {
  version: string;               // Config schema version, e.g., "1.0"

  // ── Storage Mode ────────────────────────────────────
  storageMode: 'local' | 'cloudflare' | 'hybrid';
  // hybrid = local as primary, cloudflare as backup/sync

  // ── Local Mode Config ───────────────────────────────
  local: {
    dataPath: string;            // Default: ~/.lucineer
    assetsPath: string;          // Default: ~/.lucineer/assets
    dbPath: string;              // Default: ~/.lucineer/db.sqlite
    keysFile: string;            // Default: ~/.lucineer/keys.json
    maxAssetSizeMb: number;      // Default: 100
  };

  // ── Cloudflare Mode Config ──────────────────────────
  cloudflare: {
    accountId: string;
    // API token is stored in keys.json, NOT here
    r2Bucket: string;            // Default: "lucineer-assets"
    d1DatabaseId: string;
    d1DatabaseName: string;      // Default: "lucineer"
    kvNamespaceId: string;
    vectorizeIndexName: string;  // Default: "lucineer-content"
    workerName: string;          // Default: "lucineer-worker"
    pagesProjectName: string;    // Default: "lucineer"
    customDomain?: string;       // e.g., "lucineer.yourdomain.com"
  };

  // ── Community Hub ───────────────────────────────────
  community: {
    enabled: boolean;
    hubUrl: string;              // Default: "https://community.lucineer.com"
    // API key for publishing is in keys.json
    username?: string;           // Display name for community (optional)
    shareByDefault: boolean;     // Default: false
    allowDownload: boolean;      // Default: true
    selfHostedHub?: string;      // URL to your own hub instance
  };

  // ── Privacy ─────────────────────────────────────────
  privacy: {
    analyticsEnabled: boolean;          // Default: false
    crashReportsEnabled: boolean;       // Default: false
    telemetryEnabled: boolean;          // Default: false
    adPersonalizationEnabled: boolean;  // Default: false
    showAds: boolean;                   // Default: true (false in BYOC mode)
  };

  // ── App Preferences ─────────────────────────────────
  preferences: {
    defaultAgeLevel: 'elementary' | 'middle' | 'high';
    language: string;                   // BCP-47, e.g., "en"
    theme: 'dark' | 'light' | 'system';
    fullscreenOnLaunch: boolean;
    soundEnabled: boolean;
  };

  // ── Feature Flags ───────────────────────────────────
  features: {
    debateSimulation: boolean;
    synthEngine: boolean;
    voxelExplorer: boolean;
    llnPlayground: boolean;
    minecraftBridge: boolean;   // Export chip designs to Minecraft mod
    multiplayerEnabled: boolean;
    communityHub: boolean;
  };
}

export const DEFAULT_CONFIG: LucineerConfig = {
  version: '1.0',
  storageMode: 'local',
  local: {
    dataPath: '~/.lucineer',
    assetsPath: '~/.lucineer/assets',
    dbPath: '~/.lucineer/db.sqlite',
    keysFile: '~/.lucineer/keys.json',
    maxAssetSizeMb: 100,
  },
  cloudflare: {
    accountId: '',
    r2Bucket: 'lucineer-assets',
    d1DatabaseId: '',
    d1DatabaseName: 'lucineer',
    kvNamespaceId: '',
    vectorizeIndexName: 'lucineer-content',
    workerName: 'lucineer-worker',
    pagesProjectName: 'lucineer',
  },
  community: {
    enabled: false,
    hubUrl: 'https://community.lucineer.com',
    shareByDefault: false,
    allowDownload: true,
  },
  privacy: {
    analyticsEnabled: false,
    crashReportsEnabled: false,
    telemetryEnabled: false,
    adPersonalizationEnabled: false,
    showAds: true,
  },
  preferences: {
    defaultAgeLevel: 'elementary',
    language: 'en',
    theme: 'dark',
    fullscreenOnLaunch: false,
    soundEnabled: true,
  },
  features: {
    debateSimulation: true,
    synthEngine: true,
    voxelExplorer: true,
    llnPlayground: true,
    minecraftBridge: false,
    multiplayerEnabled: false,
    communityHub: false,
  },
};
```

---

## 3. API Keys Schema (`~/.lucineer/keys.json`)

```typescript
// Stored LOCALLY on user's machine — never sent to Lucineer servers
// AES-256 encrypted at rest using a machine-derived key

export interface LucineerKeys {
  version: string;

  cloudflare?: {
    apiToken: string;       // Cloudflare API token (scoped — see permissions below)
    accountId: string;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
  };

  ai?: {
    zai?: string;           // z.ai API key
    anthropic?: string;     // sk-ant-...
    openai?: string;        // sk-...
    google?: string;        // Gemini
    mistral?: string;
    ollama?: string;        // base URL for local Ollama (no key needed)
    custom?: Record<string, { baseUrl: string; apiKey: string }>;
  };

  community?: {
    hubApiKey?: string;     // For publishing to the community hub
  };
}
```

**Cloudflare API Token Permissions (minimum required):**
```
Account permissions:
  - Cloudflare Pages: Edit
  - Workers Scripts: Edit
  - Workers KV Storage: Edit
  - D1: Edit
  - R2: Edit
  - Vectorize: Edit

Zone permissions (only if using custom domain):
  - DNS: Edit
  - Zone Settings: Read
```

**Security note:** The API token is stored encrypted on disk.
Key derivation: `PBKDF2(machine_id + salt, 100000 iterations, SHA-256)` → AES-256-GCM

---

## 4. Storage Adapter Interface

```typescript
// src/lib/storage/StorageAdapter.ts

export interface StorageAdapter {
  // ── Assets (images, audio, 3D models, exports) ──
  uploadAsset(key: string, data: Buffer, contentType: string): Promise<string>;  // returns URL
  downloadAsset(key: string): Promise<Buffer>;
  deleteAsset(key: string): Promise<void>;
  listAssets(prefix?: string): Promise<{ key: string; size: number; updatedAt: Date }[]>;

  // ── Structured Data (user progress, game state, chip designs) ──
  get<T>(collection: string, id: string): Promise<T | null>;
  put<T>(collection: string, id: string, data: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  query<T>(collection: string, filter?: Partial<T>): Promise<T[]>;

  // ── Key-Value (settings, cache, session) ──
  kvGet(key: string): Promise<string | null>;
  kvSet(key: string, value: string, ttlSeconds?: number): Promise<void>;
  kvDelete(key: string): Promise<void>;

  // ── Vector Search (AI content retrieval) ──
  vectorUpsert(id: string, vector: number[], metadata?: Record<string, unknown>): Promise<void>;
  vectorSearch(vector: number[], topK?: number): Promise<{ id: string; score: number; metadata?: unknown }[]>;

  // ── Health ──
  ping(): Promise<boolean>;
  getStorageMode(): 'local' | 'cloudflare';
}
```

---

## 5. Cloudflare Setup Flow (BYOC Onboarding)

When a user selects "Connect Cloudflare Account":

```
Step 1: Enter Cloudflare API Token + Account ID
  → Validate token permissions (call CF API)
  → Show which permissions are present / missing

Step 2: Auto-provision resources (one click)
  → POST /api/byoc/cf-setup
  → Creates:
      wrangler d1 create lucineer
      wrangler kv:namespace create LUCINEER_CACHE
      wrangler r2 bucket create lucineer-assets
      wrangler vectorize create lucineer-content --dimensions=1536
  → Stores IDs in config

Step 3: Deploy personal Worker (optional)
  → Deploys a personal copy of Lucineer Workers to user's account
  → User gets their own lucineer.USERNAME.workers.dev URL
  → Can use their own domain

Step 4: Migrate existing data (optional)
  → If user had local data, offer to sync it up to their Cloudflare account
```

**Onboarding API: `POST /api/byoc/cf-setup`**

```typescript
// Request
interface CFSetupRequest {
  accountId: string;
  apiToken: string;
  options: {
    createD1: boolean;
    createR2: boolean;
    createKV: boolean;
    createVectorize: boolean;
    deployWorker: boolean;
    customDomain?: string;
  };
}

// Response
interface CFSetupResponse {
  success: boolean;
  created: {
    d1?: { id: string; name: string };
    r2?: { bucketName: string };
    kv?: { id: string; name: string };
    vectorize?: { indexName: string };
    worker?: { url: string };
  };
  errors: string[];
}
```

---

## 6. Community Content Pack Schema

```typescript
// src/lib/community/PackSchema.ts

export type PackType =
  | 'lesson'      // A structured lesson with content, quizzes, characters
  | 'adventure'   // A story/quest chain (like a game campaign)
  | 'asset'       // Art assets, character skins, sound packs
  | 'chip-design' // A saved chip design (web or Minecraft)
  | 'character'   // A new NPC character definition
  | 'theme'       // UI theme / color scheme

export interface CommunityPack {
  // ── Identity ──────────────────────────────────────
  id: string;                          // UUID, generated on first publish
  version: string;                     // Semver: "1.0.0"
  schema: string;                      // Pack schema version: "1.0"

  // ── Metadata ──────────────────────────────────────
  name: string;
  description: string;
  type: PackType;
  tags: string[];                      // e.g., ["elementary", "transistors", "chip-design"]
  language: string;                    // BCP-47

  // ── Authorship (privacy-respecting) ───────────────
  author: {
    displayName: string;               // Can be "Anonymous"
    profileUrl?: string;               // Optional link
    isAnonymous: boolean;
  };
  license: 'MIT' | 'CC0' | 'CC-BY' | 'CC-BY-SA' | 'All Rights Reserved';
  createdAt: string;                   // ISO 8601
  updatedAt: string;

  // ── Content (varies by type) ──────────────────────
  content: LessonContent | AdventureContent | AssetContent | ChipDesignContent | CharacterContent | ThemeContent;

  // ── Compatibility ─────────────────────────────────
  minAppVersion: string;               // Semver
  targetAgeLevel?: 'elementary' | 'middle' | 'high' | 'all';

  // ── Community Stats (server-side only, not in pack file) ──
  // downloads: number;
  // rating: number;
  // reviews: Review[];
}

// ── Lesson Pack Content ────────────────────────────

export interface LessonContent {
  ageLevel: 'elementary' | 'middle' | 'high' | 'all';
  subject: string;                     // e.g., "transistors", "memory", "networking"
  objectives: string[];
  prerequisites: string[];
  estimatedMinutes: number;
  sections: LessonSection[];
  quiz?: QuizQuestion[];
  characters?: string[];               // Character IDs used in this lesson
}

export interface LessonSection {
  title: string;
  type: 'text' | 'interactive' | 'voxel-demo' | 'video' | 'quiz';
  content: string;                     // Markdown
  assets?: string[];                   // Asset keys
}

export interface QuizQuestion {
  question: string;
  type: 'multiple-choice' | 'true-false' | 'free-response';
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
}

// ── Adventure Pack Content ─────────────────────────

export interface AdventureContent {
  synopsis: string;
  chapters: AdventureChapter[];
  characters: CharacterDefinition[];
  rewards?: {
    chipDesigns?: ChipDesign[];
    characterUnlocks?: string[];
    achievements?: string[];
  };
}

export interface AdventureChapter {
  id: string;
  title: string;
  narrative: string;                    // Markdown story text
  challenge?: ChipChallenge;           // Optional chip-building challenge
  completionCondition: string;
  nextChapter?: string;
}

export interface ChipChallenge {
  description: string;
  requiredBlocks: { type: string; minCount: number }[];
  maxPowerWatts?: number;
  minRating?: 'S' | 'A' | 'B' | 'C';
}

// ── Character Pack Content ─────────────────────────

export interface CharacterDefinition {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  bgColor: string;
  description: Record<'elementary' | 'middle' | 'high', string>;
  dialogue: Record<'elementary' | 'middle' | 'high', string[]>;
  avatarAsset?: string;                // Key to asset in pack
}

// ── Chip Design Pack Content ───────────────────────

export interface ChipDesignContent {
  grid: (string | null)[][];          // 8x8, null = empty, string = block type ID
  name: string;
  description: string;
  stats: {
    totalPower: number;
    totalArea: number;
    blockCounts: Record<string, number>;
  };
  source: 'web' | 'minecraft';
  rating?: 'S' | 'A' | 'B' | 'C' | 'D';
}
```

---

## 7. Community Hub Architecture (Self-Hostable)

The community hub is a **separate, minimal Next.js app** that anyone can self-host.
The official hub runs at `community.lucineer.com`.

```
community-hub/                    ← Separate open-source repo
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── packs/
│   │   │   │   ├── route.ts      ← GET (browse) / POST (publish)
│   │   │   │   └── [id]/route.ts ← GET (download) / DELETE (remove own)
│   │   │   └── search/route.ts   ← Full-text + tag search
│   │   ├── browse/page.tsx
│   │   └── pack/[id]/page.tsx
│   └── lib/
│       └── db.ts                 ← SQLite (lightweight, self-hostable)
└── README.md                     ← "Deploy your own hub in 5 minutes"
```

**Community Hub API (consumed by Lucineer app):**

```
GET  /api/packs?type=lesson&tag=transistors&ageLevel=elementary&page=1
POST /api/packs          ← publish (requires community hub API key)
GET  /api/packs/:id      ← download pack JSON
GET  /api/search?q=chip  ← full-text search
```

---

## 8. Privacy Guarantees

| What | Guarantee |
|------|-----------|
| **Local mode** | Zero network calls for data. All processing on-device. |
| **BYOC mode** | Data goes directly to **your** Cloudflare account via your API token. Lucineer.com never sees it. |
| **Community publishing** | Opt-in only. You choose what to share. Anonymous option available. |
| **Analytics** | Off by default. If enabled, only aggregate counters — no user identification. |
| **AI API calls** | Your API keys are used directly. Lucineer never proxies AI calls in local/BYOC mode. |
| **Ads** | Disabled automatically in BYOC mode. Consent required in hosted mode. |
| **Keys file** | Encrypted at rest on your machine. Never uploaded. |

---

## 9. Open Source Repository Structure

```
github.com/lucineer/lucineer          ← Main web app (this repo)
github.com/lucineer/community-hub     ← Community hub (separate, minimal)
github.com/lucineer/chipcraft-mod     ← Minecraft Forge mod
github.com/lucineer/lucineer-assets   ← Default assets (CC0 licensed)
github.com/lucineer/docs              ← Documentation site (Starlight/Astro)
```

**License:** MIT for code. CC0 or CC-BY for default educational content.

**Contributing:**
- Issues: GitHub Issues
- Community packs: via the community hub (no PR needed)
- Code: standard fork → PR workflow
- Translations: Hosted on Weblate (self-hosted)

---

## 10. Settings UI Flow

```
Settings → Storage & Privacy
  ┌─────────────────────────────────────────────────────┐
  │  Where does your data live?                         │
  │                                                     │
  │  ○ Local only (default)                             │
  │    All data stored on this device.                  │
  │    No internet required.                            │
  │                                                     │
  │  ○ My Cloudflare account (BYOC)                    │
  │    Free tier covers everything.                     │
  │    Your data, your account, your control.           │
  │    [Connect Cloudflare →]                           │
  │                                                     │
  │  ○ Both (local + Cloudflare sync)                  │
  │    Local-first with cloud backup.                   │
  │                                                     │
  ├─────────────────────────────────────────────────────┤
  │  Community                                          │
  │  ○ Disabled (default)                              │
  │  ○ Browse & download (read only)                   │
  │  ○ Participate (browse + publish)                  │
  │    Hub: [community.lucineer.com ▼]                 │
  ├─────────────────────────────────────────────────────┤
  │  AI API Keys                                        │
  │  Stored encrypted on your device only.             │
  │  [Manage Keys →]                                   │
  ├─────────────────────────────────────────────────────┤
  │  Privacy                                            │
  │  [ ] Anonymous analytics (helps improve Lucineer)  │
  │  [ ] Personalized ads                              │
  └─────────────────────────────────────────────────────┘
```

---

## 11. "Bring Your Own AI" — Multi-Provider Schema

Users aren't locked to any AI provider. The AI layer is fully swappable.

```typescript
// src/lib/ai/AIProviderConfig.ts

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: AIModel[];
  authType: 'api-key' | 'oauth' | 'none';   // none = local Ollama
  free: boolean;
  local: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'zai',
    name: 'z.ai',
    baseUrl: 'https://api.z.ai/v1',
    models: ['z-dev-1', 'z-dev-turbo'],
    authType: 'api-key',
    free: false,
    local: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    authType: 'api-key',
    free: false,
    local: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
    authType: 'api-key',
    free: false,
    local: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    models: ['llama3.2', 'mistral', 'phi3', 'gemma2'],
    authType: 'none',
    free: true,
    local: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    models: [],   // discovered dynamically
    authType: 'none',
    free: true,
    local: true,
  },
];
```

**Privacy implication:** Users who connect Ollama or LM Studio get fully local AI — no API calls leave their machine at all. Combined with local storage mode, this creates a completely offline, private experience.

---

## 12. Cloudflare Vectorize — Educational Content Index

When in BYOC mode, the user's own Vectorize index stores embeddings of:
- Their chip designs (for "find similar designs")
- Community packs they've downloaded (for "find related lessons")
- Their learning history (for personalized recommendations)

All queries run against **their own** Vectorize index — no shared search index.

```typescript
// Embedding schema for Vectorize
interface ContentVector {
  id: string;                    // "design:uuid" | "lesson:uuid" | "progress:date"
  values: number[];              // 1536-dim embedding (OpenAI ada-002 or local equivalent)
  metadata: {
    type: 'chip-design' | 'lesson' | 'adventure' | 'progress';
    title: string;
    ageLevel?: string;
    tags: string[];
    createdAt: string;
    isLocal: boolean;            // Always true for user's own content
  };
}
```

---

## 13. Migration Path

```
Current state (as-built):
  All API routes use in-memory stores
  Prisma schema exists but unused
  No auth configured

Migration path to BYOC architecture:
  Step 1: Replace in-memory stores with StorageAdapter calls
  Step 2: Default StorageAdapter = LocalStorageAdapter (SQLite via Prisma)
  Step 3: Add CloudflareStorageAdapter (D1 for DB, R2 for assets, KV for cache)
  Step 4: Build Settings UI (StorageModeSelector, CloudflareConnect, ApiKeyManager)
  Step 5: Add BYOC onboarding (cf-setup API route)
  Step 6: Add community hub integration
  Step 7: Launch community hub as separate service
```
