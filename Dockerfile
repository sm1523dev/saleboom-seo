# syntax=docker/dockerfile:1

# Build stages run on the host platform (amd64) — no QEMU emulation for heavy steps.
# Only the final runtime stage targets the actual deployment platform (arm64 on Pi).

FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV AUTH_SECRET=build-placeholder
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# premigrate.mjs runs as a plain Node script (outside the Next.js bundle) and
# needs postgres + drizzle-orm on disk. Standalone output only includes what
# Next.js itself uses at runtime; copy these directly from the deps stage.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# Create storage directory for local credential files (writable by nextjs user)
RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run pending DB migrations before starting the server.
# premigrate.mjs auto-registers hand-written .sql files then calls drizzle migrate().
CMD ["sh", "-c", "node scripts/premigrate.mjs && node server.js"]
