/**
 * Stable filesystem anchors for backend test-support modules.
 *
 * Two consumers historically relied on fragile path resolution:
 *
 *   - `runMigrations` (test-support/db/migrate.ts) passed
 *     `'./migrations/core'` to Drizzle's migrator. This is cwd-relative,
 *     which works under vitest (cwd is `apps/backend/`) but breaks when
 *     the bundled `dist/server-test.js` is invoked from the repo root.
 *   - The FGA seeder (test-support/fga/index.ts) read the authorization
 *     DSL via `path.resolve(__dirname, '../../../../../packages/...')`.
 *     The five-level traversal is calibrated for the TypeScript source
 *     tree (`src/test-support/fga/`), but in the bundled output
 *     `__dirname` is `dist/` and the same offset climbs out of the repo.
 *
 * Both call sites now resolve against `BACKEND_ROOT` / `MONOREPO_ROOT`
 * computed here. The lookup walks up the filesystem from this module's
 * location until it finds the `roar-backend` package — robust across:
 *
 *   - vitest unit/integration tests (loaded from `src/` via tsx)
 *   - bundled production output (`dist/server.js` / `dist/server-test.js`)
 *   - any future restructure that moves source or bundle around within
 *     the workspace, since the helper keys off `package.json` content
 *     rather than directory-depth assumptions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const startDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk up the filesystem from `startDir` looking for a `package.json`
 * whose `name` field matches `packageName`. Returns the directory
 * containing that `package.json`.
 *
 * @throws if no matching package.json is found before reaching the
 * filesystem root.
 */
function findPackageRoot(packageName: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string };
        if (pkg.name === packageName) return dir;
      } catch {
        // Skip unparseable package.json files and continue walking.
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error(`[paths] Could not locate package "${packageName}" walking up from ${startDir}`);
}

/**
 * Absolute path to the `apps/backend` directory containing the
 * `roar-backend` package.json. Migrations, generated SQL, and other
 * backend-local resources hang off this anchor.
 */
export const BACKEND_ROOT = findPackageRoot('roar-backend');

/**
 * Absolute path to the monorepo root (parent of `apps/`). Cross-package
 * resources (the FGA authorization-model DSL in `packages/authz/`,
 * shared config in `packages/config-<name>/`) hang off this anchor.
 *
 * Encoded relative to `BACKEND_ROOT` rather than via a second
 * `findPackageRoot('roar-dashboard')` call so a future root-package
 * rename doesn't silently break it. `apps/<name>` → two levels up is
 * stable across the existing monorepo layout.
 */
export const MONOREPO_ROOT = path.resolve(BACKEND_ROOT, '..', '..');
