import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Version-parity guard for `@roar-platform/assessment-schema`.
 *
 * This package is the single source of truth for facts the backend, dashboard, and every
 * assessment must agree on — task IDs (`tasks.slug`), score names, domains, and variant
 * metadata. Two resolved copies at different versions is precisely that disagreement, and
 * because the package is a plain `dependency` rather than a `peerDependency`, npm resolves
 * a mismatch by silently nesting a second copy instead of failing the install. The failure
 * then surfaces as mis-keyed scores rather than an error.
 *
 * `dependency` is the deliberate choice: a consumer must never have to supply the shared
 * vocabulary itself, which is what a peer declaration would demand. This test recovers the
 * drift detection that a peer range would have given for free.
 *
 * Note on caching: the repo's Turbo `test` task uses `$TURBO_DEFAULT$` inputs, which cover
 * only this package's own files, so a *local* cache hit can mask a manifest change made
 * elsewhere. CI has no remote cache and no `actions/cache` for Turbo, so it always runs
 * cold and this test always executes there. If remote caching is ever enabled, give this
 * task explicit inputs covering the workspace manifests, or mark it uncached.
 */

const PACKAGE_NAME = '@roar-platform/assessment-schema';

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

/** `packages/assessment-schema/src` -> repo root. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface Manifest {
  name?: string;
  version?: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface Declaration {
  /** Declaring workspace's package name, e.g. `@roar-platform/roar-swr`. */
  workspace: string;
  /** Manifest path relative to the repo root, for actionable failure messages. */
  manifestPath: string;
  section: (typeof DEPENDENCY_SECTIONS)[number];
  range: string;
}

function readManifest(absolutePath: string): Manifest {
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as Manifest;
}

/**
 * Expands the root `workspaces` patterns into concrete manifest paths.
 *
 * Only the trailing-`*` form used by this repo is supported. Anything else throws rather
 * than silently collecting a subset — a pattern this doesn't understand would make the
 * whole test pass vacuously, which is worse than failing.
 *
 * @param patterns - `workspaces` entries from the root manifest
 * @returns Repo-root-relative paths to each workspace's package.json
 */
function expandWorkspacePatterns(patterns: string[]): string[] {
  const manifests: string[] = [];

  for (const pattern of patterns) {
    if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) {
      throw new Error(
        `Unsupported workspaces pattern "${pattern}". This test only understands a trailing "/*"; ` +
          'extend expandWorkspacePatterns() so parity is not silently skipped.',
      );
    }

    const parent = pattern.slice(0, -2);
    const parentPath = join(REPO_ROOT, parent);

    for (const entry of readdirSync(parentPath)) {
      const manifestPath = join(parent, entry, 'package.json');
      if (statSync(join(REPO_ROOT, parent, entry)).isDirectory()) {
        try {
          statSync(join(REPO_ROOT, manifestPath));
        } catch {
          continue; // directory without a manifest is not a workspace
        }
        manifests.push(manifestPath);
      }
    }
  }

  return manifests.sort();
}

/**
 * Collects every declaration of the schema package across all workspaces.
 *
 * @returns One entry per declaring workspace and dependency section
 */
function collectDeclarations(): Declaration[] {
  const root = readManifest(join(REPO_ROOT, 'package.json'));

  if (!root.workspaces?.length) {
    throw new Error(`No workspaces found in ${join(REPO_ROOT, 'package.json')}; REPO_ROOT is wrong.`);
  }

  const declarations: Declaration[] = [];

  for (const manifestPath of expandWorkspacePatterns(root.workspaces)) {
    const manifest = readManifest(join(REPO_ROOT, manifestPath));

    for (const section of DEPENDENCY_SECTIONS) {
      const range = manifest[section]?.[PACKAGE_NAME];
      if (range) {
        declarations.push({
          workspace: manifest.name ?? manifestPath,
          manifestPath,
          section,
          range,
        });
      }
    }
  }

  return declarations;
}

/**
 * Extracts the major version from a semver range.
 *
 * Handles the comparator prefixes this repo actually uses. Unrecognised ranges throw rather
 * than being skipped, so an exotic range can't quietly bypass the parity assertion.
 *
 * @param range - A semver range such as `^1.2.3` or `>=1.2.3`
 * @returns The major version component
 */
function majorOf(range: string): number {
  const match = /^(?:\^|~|>=|<=|=|>|<)?\s*(\d+)\./.exec(range.trim());

  if (!match?.[1]) {
    throw new Error(
      `Could not read a major version from range "${range}". Extend majorOf() so parity is not silently skipped.`,
    );
  }

  return Number(match[1]);
}

/**
 * Renders declarations grouped by range, smallest group first.
 *
 * Grouping is what makes a divergence actionable: with fifteen declaring workspaces, a flat
 * list buries the one outlier, whereas the smallest group is almost always the mistake.
 *
 * @param declarations - All collected declarations
 * @returns One line per distinct range, listing the workspaces that declare it
 */
function describeRangeGroups(declarations: Declaration[]): string[] {
  const byRange = new Map<string, Declaration[]>();

  for (const declaration of declarations) {
    const group = byRange.get(declaration.range) ?? [];
    group.push(declaration);
    byRange.set(declaration.range, group);
  }

  return [...byRange.entries()]
    .sort(([, a], [, b]) => a.length - b.length)
    .map(([range, group]) => `${range} (${group.length}): ${group.map((d) => d.workspace).join(', ')}`);
}

describe(`${PACKAGE_NAME} version parity`, () => {
  const declarations = collectDeclarations();
  const schemaVersion = readManifest(join(REPO_ROOT, 'packages/assessment-schema/package.json')).version;

  // Each assertion below compares a diagnostic array against `[]` rather than passing a
  // custom message to `expect`, which the shared `vitest/valid-expect` rule disallows. The
  // upside is that the failure diff prints the offending workspaces directly.

  it('is declared by the assessments, backend, dashboard, and SDK', () => {
    // Guards against the discovery logic finding nothing, which would make every other
    // assertion in this file pass vacuously.
    expect(declarations.length).toBeGreaterThan(0);

    const workspaces = new Set(declarations.map((declaration) => declaration.workspace));
    expect(workspaces).toContain('roar-backend');
    expect(workspaces).toContain('roar-dashboard');
    expect(workspaces).toContain('@roar-platform/assessment-sdk');
  });

  it('is declared with an identical version range in every workspace', () => {
    const ranges = new Set(declarations.map((declaration) => declaration.range));

    // Divergent ranges mean a published install would resolve more than one copy, so task
    // IDs and score names could disagree between workspaces.
    const divergence = ranges.size > 1 ? describeRangeGroups(declarations) : [];

    expect(divergence).toEqual([]);
  });

  it('is declared with a range matching the package major', () => {
    expect(schemaVersion).toBeTruthy();
    const packageMajor = majorOf(schemaVersion!);

    // A workspace left on an older major would fetch a stale registry copy on a published
    // install instead of resolving this one.
    const stale = declarations
      .filter((declaration) => majorOf(declaration.range) !== packageMajor)
      .map(
        (declaration) =>
          `${declaration.workspace} (${declaration.manifestPath}) declares ${declaration.range}, package is ${schemaVersion}`,
      );

    expect(stale).toEqual([]);
  });

  it('resolves to exactly one copy in the lockfile', () => {
    const lockfile = JSON.parse(readFileSync(join(REPO_ROOT, 'package-lock.json'), 'utf8')) as {
      packages?: Record<string, { resolved?: string; link?: boolean; version?: string }>;
    };

    const canonicalPath = `node_modules/${PACKAGE_NAME}`;
    const entries = Object.entries(lockfile.packages ?? {}).filter(([path]) => path.endsWith(canonicalPath));

    // Any entry other than the top-level workspace link is a nested duplicate copy, which
    // is the drift this test exists to catch. Asserting on the rendered paths rather than a
    // count means the failure names the offender instead of just reporting "expected 1".
    const duplicates = entries
      .filter(([path]) => path !== canonicalPath)
      .map(([path, entry]) => `${path} -> ${entry.resolved ?? entry.version}`);

    expect(duplicates).toEqual([]);

    // The surviving entry must be the workspace itself, not a registry tarball.
    const canonical = entries.find(([path]) => path === canonicalPath)?.[1];
    expect(canonical?.resolved).toBe('packages/assessment-schema');
    expect(canonical?.link).toBe(true);
  });
});
