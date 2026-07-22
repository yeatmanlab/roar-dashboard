# ──────────────────────────────────────────────────────────────────────────────
# assessment.Dockerfile
#
# Backend image for the local assessment environment. The assessment-runtime
# target runs DB migrations (CMD override in compose) or serves the backend API
# (default CMD). The Firebase emulator uses the shared image in
# docker/firebase-emulator/ instead.
#
# Used exclusively by docker-compose.assessment.yml.
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Install dependencies and build
# ──────────────────────────────────────────────────────────────────────────────
FROM node:24 AS builder

RUN npm install turbo --global

WORKDIR /app

# Copy package manifests for the workspaces needed to build the backend.
# Assessment workspace stubs are not needed — npm ci resolves only what
# the backend's dependency tree requires, and the assessment glob matches
# nothing when assessment directories aren't present in the build context.
COPY package.json package-lock.json ./
COPY apps/backend/package.json                    apps/backend/
COPY packages/api-contract/package.json           packages/api-contract/
COPY packages/assessment-schema/package.json      packages/assessment-schema/
COPY packages/assessment-sdk/package.json         packages/assessment-sdk/
COPY packages/scoring-tables/package.json         packages/scoring-tables/
COPY packages/authz/package.json                  packages/authz/
COPY packages/config-eslint/package.json          packages/config-eslint/
COPY packages/config-prettier/package.json        packages/config-prettier/
COPY packages/config-typescript/package.json      packages/config-typescript/

RUN npm ci --ignore-scripts

# Copy source for packages that must be built.
# Layer order: packages with fewer transitive deps first so cache busts are narrow.
COPY packages/config-typescript/  packages/config-typescript/
COPY packages/scoring-tables/     packages/scoring-tables/
COPY packages/assessment-schema/  packages/assessment-schema/
COPY packages/api-contract/       packages/api-contract/
COPY apps/backend/                apps/backend/
COPY turbo.json                   ./

# turbo resolves build order automatically (scoring-tables, assessment-schema and
# api-contract before the backend).
RUN turbo build --filter=roar-backend

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Assessment runtime
# Serves as both migration runner and API server in docker-compose.assessment.yml.
# ──────────────────────────────────────────────────────────────────────────────
FROM node:24-slim AS assessment-runtime

RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends curl \
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

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "apps/backend/dist/server.js"]
