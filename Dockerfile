# syntax=docker/dockerfile:1

# ── Production image for the VPS deploy (Selectel/Timeweb/Hetzner) ────────────
# Multi-stage: deps → builder (next build, standalone) → runner (node server.js).
# Base is Debian slim (glibc) so sharp's prebuilt binaries and the Prisma
# debian-openssl-3.0.x query engine both work out of the box.

# Full bookworm (not -slim): ships openssl/libssl3 + ca-certificates out of the
# box, which Prisma needs to select the debian-openssl-3.0.x engine. (-slim omits
# them and requires `apt-get install openssl`; the full image avoids that step.)
FROM node:22-bookworm AS base

# ── deps: install node_modules (incl. dev — needed to build) ─────────────────
# NODE_ENV is deliberately NOT "production" here: `npm ci` would then skip
# devDependencies (tailwind/postcss/next build toolchain) and the build fails.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── builder: prisma generate + next build (standalone output) ────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined at build time, so they must be present here.
# Pass via `docker build --build-arg` or compose `build.args`.
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# Build-time PLACEHOLDER env. `next build` imports route modules to collect page
# data, and Auth.js (+ our Zod env schema) read these at module init — without
# them the build throws "Failed to collect page data". These are throwaway dummies:
# they live only in this builder layer (discarded in the runner stage) and are NOT
# baked into the output — server-side env is read at runtime from the real env_file.
# (NEXT_PUBLIC_* above are the only values inlined into the bundle.)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    DIRECT_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build_time_placeholder_secret_0000" \
    AUTH_URL="https://build.local" \
    AUTH_GOOGLE_ID="build" \
    AUTH_GOOGLE_SECRET="build" \
    R2_ACCOUNT_ID="build" \
    R2_ACCESS_KEY_ID="build" \
    R2_SECRET_ACCESS_KEY="build" \
    R2_BUCKET="build" \
    R2_PUBLIC_URL="https://cdn.build.local" \
    REDIS_DRIVER="redis" \
    REDIS_URL="redis://localhost:6379" \
    PAIR_TOKEN_SECRET="build_time_placeholder_pairtoken_0" \
    CLOUDFLARE_ACCOUNT_ID="build" \
    CLOUDFLARE_API_TOKEN="build" \
    SENTRY_DSN="https://build@build.ingest.sentry.io/1"

RUN npx prisma generate
RUN npm run build

# ── migrate: one-shot stage to apply DB migrations before the app starts ─────
# Run as a separate compose service (not a per-container entrypoint) so migrations
# apply exactly once per deploy, not once per replica (which would race).
FROM base AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
# Reads DATABASE_URL/DIRECT_URL from the runtime env_file; exits 0 when done.
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runner: minimal runtime, non-root, just the standalone server ────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Standalone server binds to this host/port inside the container.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Static assets + public/ are NOT bundled into standalone — copy them alongside.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma query engine + generated client: standalone tracing can miss the native
# engine, so copy the generated artifacts explicitly into the traced node_modules.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

# next build (standalone) emits server.js at the app root.
CMD ["node", "server.js"]
