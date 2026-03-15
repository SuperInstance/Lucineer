# Schema 01 — Cloudflare Deployment
## Lucineer · lucineer.com

---

## Overview

Two deployment targets are defined here:

| Target | Use Case | Cost Model |
|--------|----------|------------|
| **Cloudflare Pages + Workers** | Primary. Serverless Next.js, scales to zero, cheapest | Free tier covers most traffic; $5/mo Workers Paid plan |
| **Cloudflare Containers (Docker)** | Fallback if Node-specific SDK deps block Workers runtime | Billed per CPU-ms, spins down when idle |

---

## 1. Directory Structure After Build

```
lucineer/
├── .next/
│   └── standalone/          ← Docker copies this entire directory
│       ├── server.js        ← Entry point (bun server.js)
│       ├── .next/
│       │   └── static/      ← Static assets (copied by build script)
│       └── public/          ← Public assets (copied by build script)
├── docs/
├── prisma/
│   └── schema.prisma
├── src/
├── Dockerfile               ← Created below
├── .dockerignore            ← Already exists
├── wrangler.toml            ← Created below
├── .env.production          ← Never committed; injected at deploy time
└── package.json
```

---

## 2. Dockerfile

```dockerfile
# ─────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app

COPY package.json bun.lockb* ./
# Install all deps (including devDependencies for build)
RUN bun install --frozen-lockfile

# ─────────────────────────────────────────────────
# Stage 2: Build the Next.js app
# ─────────────────────────────────────────────────
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before build
RUN bunx prisma generate

# Build Next.js standalone output
RUN bun run build

# ─────────────────────────────────────────────────
# Stage 3: Production runner (minimal image)
# ─────────────────────────────────────────────────
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma engine binaries (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# SQLite data directory (mountable volume)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

CMD ["bun", "server.js"]
```

---

## 3. .dockerignore (verify / extend existing)

```
Dockerfile
.dockerignore
node_modules
.next
.git
*.log
.env*
!.env.example
prisma/dev.db
prisma/*.db-journal
research/
download/
docs/
*.md
!README.md
```

---

## 4. Environment Variables Schema

All secrets injected at runtime — never baked into image.

### `.env.example` (committed to repo)

```env
# ── App ──────────────────────────────────────────
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://lucineer.com

# ── Database ─────────────────────────────────────
# Local SQLite (Docker volume mount)
DATABASE_URL=file:/app/data/lucineer.db
# OR Cloudflare D1 via REST (see BYOC schema)
# DATABASE_URL=libsql://lucineer.YOUR_ACCOUNT.turso.io?authToken=TOKEN

# ── Auth ─────────────────────────────────────────
NEXTAUTH_URL=https://lucineer.com
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# ── AI APIs ──────────────────────────────────────
ZAI_API_KEY=your-z.ai-key
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# ── Cloudflare (for asset storage, optional) ─────
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_R2_BUCKET=lucineer-assets
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=

# ── Ads (see schema 03) ───────────────────────────
NEXT_PUBLIC_AD_CLIENT=ca-pub-XXXXXXXXXX
NEXT_PUBLIC_AD_SLOT=XXXXXXXXXX

# ── Community Hub (optional, see BYOC schema) ─────
COMMUNITY_HUB_URL=https://community.lucineer.com
COMMUNITY_HUB_API_KEY=
```

---

## 5. wrangler.toml (Cloudflare Pages + Workers)

This config is for the **Pages + Workers** path (preferred).
Uses `@cloudflare/next-on-pages` adapter.

```toml
name = "lucineer"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# ── Pages ────────────────────────────────────────
pages_build_output_dir = ".vercel/output/static"

# ── Workers (API routes) ─────────────────────────
[build]
command = "bun run build:cf"

# ── D1 Database binding (replaces SQLite file) ───
[[d1_databases]]
binding = "DB"
database_name = "lucineer-prod"
database_id = "REPLACE_WITH_D1_ID"

# ── R2 Storage binding (assets, user uploads) ────
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "lucineer-assets"

# ── KV (session cache, feature flags) ────────────
[[kv_namespaces]]
binding = "CACHE"
id = "REPLACE_WITH_KV_ID"

# ── Vectorize (AI embeddings) ────────────────────
[[vectorize]]
binding = "VECTORIZE"
index_name = "lucineer-content"

# ── Environment Variables ─────────────────────────
[vars]
NODE_ENV = "production"
NEXT_PUBLIC_APP_URL = "https://lucineer.com"

# ── Secrets (set via: wrangler secret put SECRET_NAME) ──
# ZAI_API_KEY
# ANTHROPIC_API_KEY
# NEXTAUTH_SECRET

# ── Custom Domains ────────────────────────────────
# Set in Cloudflare Pages dashboard:
#   lucineer.com → Pages project
#   www.lucineer.com → redirect to lucineer.com

# ── Preview environments ─────────────────────────
[env.preview]
name = "lucineer-preview"
vars = { NODE_ENV = "preview", NEXT_PUBLIC_APP_URL = "https://preview.lucineer.com" }
```

---

## 6. package.json Build Scripts (additions)

```json
{
  "scripts": {
    "build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
    "build:cf": "bunx @cloudflare/next-on-pages",
    "build:docker": "docker build -t lucineer:latest .",
    "deploy:cf": "wrangler pages deploy",
    "deploy:docker": "docker push registry.lucineer.com/lucineer:latest",
    "db:cf:push": "wrangler d1 execute lucineer-prod --file=prisma/migrations/init.sql",
    "db:cf:migrate": "wrangler d1 migrations apply lucineer-prod"
  }
}
```

---

## 7. Cloudflare Containers (Docker Path — Fallback)

Use this **only if** `z-ai-web-dev-sdk` or other deps have hard Node.js dependencies that break Workers runtime.

```toml
# wrangler.toml additions for Containers path
[containers]
image = "registry.hub.docker.com/lucineer/lucineer:latest"
# OR use Cloudflare's registry:
# image = "registry.cloudflare.com/lucineer/lucineer:latest"

max_instances = 5          # scale ceiling
min_instances = 0          # scale to zero (saves money)
instance_type = "dev"      # smallest: 256MB RAM, 0.1 vCPU
```

**Cost estimate (Containers):**
- Idle: $0
- 1 concurrent user: ~$0.000024/req + $0.000012/CPU-second
- 1,000 users/day average 30s session: ~$0.40/day → ~$12/month

---

## 8. CI/CD Pipeline Schema (GitHub Actions)

```yaml
# .github/workflows/deploy.yml

name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run lint
      # Future: bun run test

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build:cf
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy --env preview

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build:cf
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy --env production
```

**Required GitHub Secrets:**
```
CLOUDFLARE_API_TOKEN     ← Pages:Edit + Workers:Edit permissions
CLOUDFLARE_ACCOUNT_ID
ZAI_API_KEY
ANTHROPIC_API_KEY
NEXTAUTH_SECRET
```

---

## 9. DNS Configuration (Cloudflare Dashboard)

```
Type    Name    Content                     Proxy
A       @       192.0.2.1                   ✅ Proxied (Pages overrides this)
CNAME   www     lucineer.pages.dev          ✅ Proxied
CNAME   api     lucineer.workers.dev        ✅ Proxied
```

**Page Rules:**
- `www.lucineer.com/*` → Redirect 301 → `https://lucineer.com/$1`
- `lucineer.com/api/*` → No cache (Cache Rule)
- `lucineer.com/_next/static/*` → Cache Everything, Edge TTL 1 year

---

## 10. Health Check & Observability

**Existing health endpoint:** `GET /api` → extend to:

```typescript
// src/app/api/route.ts — extend to full health check
export async function GET() {
  return Response.json({
    status: "ok",
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    db: "ok",           // add prisma ping
    storage: "ok",      // add R2 ping
  });
}
```

**Cloudflare Analytics:** Enable in dashboard — free, no code changes needed.

**Uptime monitoring:** Cloudflare Health Checks (Paid plan) or free UptimeRobot pointing at `https://lucineer.com/api`.

---

## Implementation Sequence

```
1. bun install
2. Create .env.production (from .env.example)
3. npx prisma generate
4. bun run build:cf                    ← compiles for Cloudflare edge
5. wrangler d1 create lucineer-prod    ← creates D1 database
6. wrangler kv:namespace create CACHE  ← creates KV namespace
7. wrangler r2 bucket create lucineer-assets
8. Update wrangler.toml with IDs from steps 5-7
9. wrangler secret put ZAI_API_KEY     ← set all secrets
10. wrangler pages deploy              ← deploys to lucineer.pages.dev
11. Set custom domain in CF dashboard  ← lucineer.com goes live
```
