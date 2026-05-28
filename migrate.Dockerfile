FROM node:22

# Install postgresql-client at build time so apt never runs during migrate execution.
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests for every workspace so npm ci can install and hoist correctly.
# These layers are cached as long as lock files and package.json files are unchanged.
#
# Source files are intentionally excluded for all workspaces except assessment-schema
# (copied below) and config-typescript (also copied below). The remaining workspaces
# are present for npm workspace graph resolution only — none of their source is imported
# at migration or seed time, so their package.json stubs are sufficient.
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

# Install dependencies. --ignore-scripts skips native addon compilation (e.g. canvas)
# which is not needed for migrations.
RUN npm ci --ignore-scripts

# Copy the full config-typescript directory now that npm ci has run. The package.json
# was copied above so that a change here doesn't invalidate the npm ci cache layer —
# only a change to package.json or package-lock.json does.
COPY packages/config-typescript/  packages/config-typescript/

# Build assessment-schema so the seed script can import from it.
# Only the TypeScript source and tsconfig are needed — no runtime source files.
COPY packages/assessment-schema/src        packages/assessment-schema/src
COPY packages/assessment-schema/tsconfig.json packages/assessment-schema/

RUN npm run build -w packages/assessment-schema
