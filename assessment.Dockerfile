# ──────────────────────────────────────────────────────────────────────────────
# assessment.Dockerfile
#
# Dual-role image for the local assessment environment.
# Two independent targets are produced from a single build context:
#
#   assessment-runtime  — runs DB migrations (CMD override in compose) or
#                         serves the backend API (default CMD).
#   firebase-emulator   — runs the Firebase Auth emulator.
#
# Used exclusively by docker-compose.assessment.yml.
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Prune the monorepo to only what roar-backend needs.
# turbo prune outputs out/json/ (manifests only) and out/full/ (full source),
# so adding new workspace members never requires extra COPY lines below.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22 AS pruner

RUN npm install turbo --global

WORKDIR /app
COPY . .
RUN turbo prune roar-backend --docker

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Install dependencies and build
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22 AS builder

RUN npm install turbo --global

WORKDIR /app

# Install against pruned manifests only — this layer is cached as long as no
# package.json or lockfile in the roar-backend dependency tree changes.
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

RUN npm ci --ignore-scripts

# Copy full pruned source and build
COPY --from=pruner /app/out/full/ .

# turbo resolves build order automatically (assessment-schema and api-contract
# before the backend).
RUN turbo build --filter=roar-backend

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3 — Assessment runtime
# Serves as both migration runner and API server in docker-compose.assessment.yml.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS assessment-runtime

RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Compiled backend bundle
COPY --from=builder /app/apps/backend/dist              ./apps/backend/dist

# Node modules (hoisted root + workspace-level)
COPY --from=builder /app/node_modules                   ./node_modules
COPY --from=builder /app/apps/backend/node_modules      ./apps/backend/node_modules

# Built workspace packages (needed for node_modules symlink resolution)
COPY --from=builder /app/packages                       ./packages

# Migration tooling: Drizzle configs, migration SQL, DB schema source, seed scripts
COPY --from=builder /app/apps/backend/migrations                   ./apps/backend/migrations
COPY --from=builder /app/apps/backend/seeds                        ./apps/backend/seeds
COPY --from=builder /app/apps/backend/drizzle.core.config.ts       ./apps/backend/drizzle.core.config.ts
COPY --from=builder /app/apps/backend/drizzle.assessment.config.ts ./apps/backend/drizzle.assessment.config.ts
COPY --from=builder /app/apps/backend/tsconfig.json                ./apps/backend/tsconfig.json
COPY --from=builder /app/apps/backend/src/db                       ./apps/backend/src/db

# Package manifests for `cd apps/backend && npm run` commands inside the container
COPY --from=builder /app/package.json                           ./package.json
COPY --from=builder /app/apps/backend/package.json              ./apps/backend/package.json

# FDW setup script — lives at repo root/scripts/, not in turbo prune output.
# Copied directly from build context.
COPY scripts/setup-fdw-local.sh ./scripts/setup-fdw-local.sh

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "apps/backend/dist/server.js"]

# ──────────────────────────────────────────────────────────────────────────────
# Stage 4 — Firebase Auth emulator (independent)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS firebase-emulator

RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# firebase-tools@13 bundles the Auth emulator as pure Node.js — no Java required.
RUN npm install -g firebase-tools@13

WORKDIR /app
EXPOSE 9099
