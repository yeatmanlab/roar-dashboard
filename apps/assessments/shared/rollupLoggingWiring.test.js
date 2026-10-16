// @vitest-environment node
// (The suite default is jsdom for variantPicker; under it Vitest routes dynamic imports
// through a root-scoped module runner that cannot reach sibling workspaces.)
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { escalateUnresolvedImports } from './rollupLogging.js';
import { browserBuiltins } from './rollupResolve.js';

/**
 * Every rollup library build must escalate an unresolved import to a build error and map Node
 * builtins through the shared alias, or it ships a package with a bare specifier in it behind a
 * green CI run.
 *
 * Discovery asserts **set equality** against the directory listing, minus an explicit exemption
 * list, rather than collecting whatever it can parse. A `length > 0` check only catches total
 * failure: `rollup --config <file>`, a bare `rollup -c`, or a `build` delegating to `build:lib`
 * each drop one assessment out of discovery while the other nine still pass — which is exactly
 * the "new assessment arrives without the convention" case this is meant to catch.
 */

const ASSESSMENTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Directories that legitimately have no rollup library build.
 * - `shared` is this package: source-only, no build.
 * - `roar-survey` builds its library with `vite build --mode lib`; Vite errors on an unresolved
 *   import natively and resolves builtins through its own browser mapping.
 */
const EXEMPT = new Set(['shared', 'roar-survey']);

const assessmentDirs = readdirSync(ASSESSMENTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(ASSESSMENTS_DIR, entry.name, 'package.json')))
  .map((entry) => entry.name);

const expected = assessmentDirs.filter((name) => !EXEMPT.has(name));

/** @returns {Map<string, string>} assessment name → config path, for builds that run rollup. */
const discovered = new Map(
  assessmentDirs.flatMap((name) => {
    const build = JSON.parse(readFileSync(path.join(ASSESSMENTS_DIR, name, 'package.json'), 'utf8')).scripts?.build;
    const config = /\brollup\b.*?(?:-c|--config)\s+(\S+)/.exec(build ?? '')?.[1];
    return config ? [[name, path.join(ASSESSMENTS_DIR, name, config)]] : [];
  }),
);

describe('rollup library builds are wired to the shared build guards', () => {
  it('discovers a rollup build for every non-exempt assessment', () => {
    // Set equality, not a count: a config this cannot parse silently removes that assessment.
    expect([...discovered.keys()].sort()).toEqual([...expected].sort());
  });

  it.each(expected)('%s wires both guards', async (name) => {
    const configPath = discovered.get(name);
    // A `-c` pointing at a missing file is itself a defect worth failing on.
    expect(existsSync(configPath)).toBe(true);

    const { default: config } = await import(pathToFileURL(configPath).href);

    // Identity, not presence: a local copy of either would drift from the shared one.
    expect(config.onLog).toBe(escalateUnresolvedImports);
    expect(config.plugins.flat(Infinity)).toContain(browserBuiltins);
  });
});
