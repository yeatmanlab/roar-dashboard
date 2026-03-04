# ============================================================
# Shared base image with Turbo CLI
# ============================================================
FROM node:20-slim AS node-image
RUN npm install turbo --global

# ============================================================
# Stage 1: Prune monorepo to backend workspace
# ============================================================
FROM node-image AS pruner

WORKDIR /app
COPY . .
RUN turbo prune roar-backend --docker

# ============================================================
# Stage 2: Install deps and build
# ============================================================
FROM node-image AS builder

WORKDIR /app

# Copy lockfile and package.json files for the pruned workspace graph
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
COPY --from=pruner /app/out/json/ .

# Install all dependencies (including devDeps needed for build tooling)
RUN npm ci

# Copy full source of the pruned workspaces
COPY --from=pruner /app/out/full/ .

# Build api-contract (needed for import resolution), then build the backend.
# Rollup bundles all dependencies into a single server.js — no node_modules at runtime.
RUN turbo build --filter=roar-backend

# ============================================================
# Stage 3: Minimal runtime image
# ============================================================
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime

WORKDIR /app

# Copy the fully-bundled backend — no node_modules needed
COPY --from=builder /app/apps/backend/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["./dist/server.js"]
