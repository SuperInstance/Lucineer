# ─────────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS deps
WORKDIR /app

# Copy lockfile and package manifest first for layer caching
COPY package.json bun.lock ./

# Install all deps (dev included — needed for Next.js build)
RUN bun install --frozen-lockfile

# ─────────────────────────────────────────────────────────────────
# Stage 2: Build the Next.js app
# ─────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS builder
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source
COPY . .

# Generate Prisma client for the correct platform
RUN bunx prisma generate

# Build Next.js standalone output + copy static/public into it
RUN bun run build

# ─────────────────────────────────────────────────────────────────
# Stage 3: Minimal production runner
# ─────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma client (engine binaries needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Persistent data directory — mount a volume here for SQLite persistence
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

# Health check hits the existing /api endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api || exit 1

CMD ["bun", "server.js"]
