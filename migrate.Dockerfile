FROM node:22

# Install postgresql-client at build time so apt never runs during migrate execution.
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests for every workspace so npm ci can install and hoist correctly.
# These layers are cached as long as lock files and package.json files are unchanged.
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
# which fails on Node 24's ABI and is not needed for migrations.
RUN npm ci --ignore-scripts

# Copy config-typescript JSON files — the npm symlink resolves to this directory,
# so tsc fails if the JSON files aren't present alongside the package.json.
COPY packages/config-typescript/  packages/config-typescript/

# Build assessment-schema so the seed script can import from it.
# Only the TypeScript source and tsconfig are needed — no runtime source files.
COPY packages/assessment-schema/src        packages/assessment-schema/src
COPY packages/assessment-schema/tsconfig.json packages/assessment-schema/

RUN npm run build -w packages/assessment-schema
