# ──────────────────────────────────────────────────────────────────────────────
# researcher.Dockerfile
#
# Dual-role image for the local researcher environment.
# Two independent targets are produced from a single build context:
#
#   researcher-runtime  — runs DB migrations (CMD override in compose) or
#                         serves the backend API (default CMD).
#   firebase-emulator   — runs the Firebase Auth emulator.
#
# Used exclusively by docker-compose.researcher.yml.
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Install dependencies and build
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22 AS builder

RUN npm install turbo --global

WORKDIR /app

# Copy package manifests for every workspace so npm ci can install and hoist
# correctly. Source files for stub workspaces are intentionally excluded —
# those packages are not imported at migration or server runtime.
COPY package.json package-lock.json ./
COPY apps/backend/package.json                    apps/backend/
COPY apps/assessments/roar-pa/package.json        apps/assessments/roar-pa/
COPY packages/api-contract/package.json           packages/api-contract/
COPY packages/assessment-schema/package.json      packages/assessment-schema/
COPY packages/assessment-sdk/package.json         packages/assessment-sdk/
COPY packages/authz/package.json                  packages/authz/
COPY packages/config-eslint/package.json          packages/config-eslint/
COPY packages/config-prettier/package.json        packages/config-prettier/
COPY packages/config-typescript/package.json      packages/config-typescript/

RUN npm ci --ignore-scripts

# Copy source for packages that must be built.
# Layer order: packages with fewer transitive deps first so cache busts are narrow.
COPY packages/config-typescript/  packages/config-typescript/
COPY packages/assessment-schema/  packages/assessment-schema/
COPY packages/api-contract/       packages/api-contract/
COPY apps/backend/                apps/backend/
COPY turbo.json                   ./

# turbo resolves build order automatically (assessment-schema and api-contract
# before the backend).
RUN turbo build --filter=roar-backend

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Researcher runtime
# Serves as both migration runner and API server in docker-compose.researcher.yml.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS researcher-runtime

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
COPY --from=builder /app/apps/backend/scripts                      ./apps/backend/scripts
COPY --from=builder /app/apps/backend/drizzle.core.config.ts       ./apps/backend/drizzle.core.config.ts
COPY --from=builder /app/apps/backend/drizzle.assessment.config.ts ./apps/backend/drizzle.assessment.config.ts
COPY --from=builder /app/apps/backend/tsconfig.json                ./apps/backend/tsconfig.json
COPY --from=builder /app/apps/backend/src/db                       ./apps/backend/src/db

# Package manifests for `cd apps/backend && npm run` commands inside the container
COPY --from=builder /app/package.json                           ./package.json
COPY --from=builder /app/apps/backend/package.json              ./apps/backend/package.json
COPY --from=builder /app/apps/assessments/roar-pa/package.json  ./apps/assessments/roar-pa/package.json

# FDW setup script — lives at repo root/scripts/, not in turbo prune output.
# Copied directly from build context.
COPY scripts/setup-fdw-local.sh ./scripts/setup-fdw-local.sh

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "apps/backend/dist/server.js"]

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3 — Firebase Auth emulator (independent)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS firebase-emulator

RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# firebase-tools@13 bundles the Auth emulator as pure Node.js — no Java required.
RUN npm install -g firebase-tools@13

WORKDIR /app
EXPOSE 9099
