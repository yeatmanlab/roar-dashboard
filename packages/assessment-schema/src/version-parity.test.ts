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

/** A parsed `major.minor.patch` version. */
interface SemverTriple {
  major: number;
  minor: number;
  patch: number;
}

/** Splits an optional comparator prefix off the version it qualifies. */
const COMPARATOR_PATTERN = /^(\^|~|>=|<=|=|>|<)?\s*(.+)$/;

/**
 * Parses a fully-specified `major.minor.patch` version.
 *
 * Anything else — a prerelease, build metadata, or a partial version such as `0.1` — throws
 * rather than being coerced, so a shape this doesn't handle can't quietly bypass the parity
 * assertion.
 *
 * @param version - A version string such as `0.1.0`
 * @returns The parsed components
 */
function parseVersion(version: string): SemverTriple {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());

  if (!match) {
    throw new Error(
      `Could not parse "${version}" as a major.minor.patch version. ` +
        'Extend parseVersion() so parity is not silently skipped.',
    );
  }

  // The pattern matched, so all three groups are present.
  return { major: Number(match[1]!), minor: Number(match[2]!), patch: Number(match[3]!) };
}

/**
 * Orders two versions.
 *
 * @param a - Left operand
 * @param b - Right operand
 * @returns Negative if `a` precedes `b`, zero if equal, positive if `a` follows `b`
 */
function compareVersions(a: SemverTriple, b: SemverTriple): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Exclusive upper bound npm derives from a caret range.
 *
 * Below 1.0.0 the caret pins the leftmost non-zero component, so `^0.1.0` admits `0.1.x` but
 * **not** `0.2.0`. That is the case a major-only comparison misses entirely: both majors are
 * 0, yet a published install of `^0.1.0` resolves the stale `0.1.x` tarball rather than the
 * current package. While this package is pre-1.0, the minor is the compatibility boundary.
 *
 * @param floor - The range's lower bound
 * @returns The first version the range excludes
 */
function caretUpperBound({ major, minor, patch }: SemverTriple): SemverTriple {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0 };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0 };
  return { major: 0, minor: 0, patch: patch + 1 };
}

/**
 * Whether a published install of `range` would resolve `version`.
 *
 * Handles the comparator prefixes this repo actually uses. An unrecognised comparator throws
 * rather than being skipped, so an exotic range can't quietly bypass the parity assertion.
 *
 * @param range - A semver range such as `^0.1.0` or `>=1.2.3`
 * @param version - The version the workspace resolves locally
 * @returns true if the range admits that version
 */
function rangeAdmits(range: string, version: SemverTriple): boolean {
  const match = COMPARATOR_PATTERN.exec(range.trim());

  if (!match?.[2]) {
    throw new Error(
      `Could not read a comparator and version from range "${range}". ` +
        'Extend rangeAdmits() so parity is not silently skipped.',
    );
  }

  const comparator = match[1] ?? '=';
  const floor = parseVersion(match[2]);
  const ordering = compareVersions(version, floor);

  switch (comparator) {
    case '^':
      return ordering >= 0 && compareVersions(version, caretUpperBound(floor)) < 0;
    case '~':
      return ordering >= 0 && compareVersions(version, { major: floor.major, minor: floor.minor + 1, patch: 0 }) < 0;
    case '=':
      return ordering === 0;
    case '>=':
      return ordering >= 0;
    case '>':
      return ordering > 0;
    case '<=':
      return ordering <= 0;
    case '<':
      return ordering < 0;
    default:
      throw new Error(
        `Unsupported comparator "${comparator}" in range "${range}". ` +
          'Extend rangeAdmits() so parity is not silently skipped.',
      );
  }
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

/**
 * `[range, version, whether the range admits it]`.
 *
 * The pre-1.0 rows are why the parity assertion calls `rangeAdmits` rather than comparing
 * majors: every one of them shares a major of 0 with the version it is checked against, so a
 * major comparison would report agreement where npm would resolve a different copy.
 */
const RANGE_ADMITS_CASES: [range: string, version: string, expected: boolean][] = [
  ['^0.1.0', '0.1.0', true],
  ['^0.1.0', '0.1.7', true],
  ['^0.1.0', '0.2.0', false],
  ['^0.1.0', '0.0.9', false],
  ['^0.0.3', '0.0.3', true],
  ['^0.0.3', '0.0.4', false],
  ['^1.2.0', '1.9.0', true],
  ['^1.2.0', '2.0.0', false],
  ['~0.1.0', '0.1.9', true],
  ['~0.1.0', '0.2.0', false],
  ['0.1.0', '0.1.1', false],
  ['>=0.1.0', '0.2.0', true],
];

/** Ranges this test deliberately refuses to interpret rather than guess at. */
const UNSUPPORTED_RANGES: string[] = ['^0.1', 'latest', 'workspace:^', '^0.1.0-rc.1'];

describe('rangeAdmits', () => {
  it.each(RANGE_ADMITS_CASES)('%s admits %s: %s', (range, version, expected) => {
    expect(rangeAdmits(range, parseVersion(version))).toBe(expected);
  });

  it.each(UNSUPPORTED_RANGES)('throws on the unsupported range %s', (range) => {
    expect(() => rangeAdmits(range, { major: 0, minor: 1, patch: 0 })).toThrow();
  });
});

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

  it('is declared with a range that admits the package version', () => {
    expect(schemaVersion).toBeTruthy();
    const packageVersion = parseVersion(schemaVersion!);

    // A range that no longer admits the current version would fetch a stale registry copy on
    // a published install instead of resolving this one. Below 1.0.0 that happens a minor at
    // a time — bumping the package to 0.2.0 while consumers declare `^0.1.0` is the drift
    // this catches, and comparing majors alone would not.
    const stale = declarations
      .filter((declaration) => !rangeAdmits(declaration.range, packageVersion))
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
