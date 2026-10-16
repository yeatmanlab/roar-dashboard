import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Object names reach the filesystem, a request URL, and a desktop opener, and they
 * come from the stand-in's listing — a dev-local service that serves back whatever
 * was written to it. The boundary filter is covered because a filter that silently
 * stops matching fails open; the flag parsing is covered because every flag here
 * decides whether a copy is kept, so dropping one silently performs the wrong
 * action and reports success.
 */
vi.mock('../context.mjs', () => ({ ASSESSMENT_GCS_PORT: '4445', ASSESSMENT_NAME: 'roar-readaloud' }));
// Stubbed rather than imported so these tests do not depend on the package being built. The
// composer reads the same suffix map it is given here, so a name that disagrees with the map
// cannot pass; the composition rule itself is covered in assessment-schema's own test.
const schema = vi.hoisted(() => {
  const ARTIFACT_BUCKET_SUFFIXES = { 'roar-readaloud': 'readaloud' };
  return {
    ARTIFACT_BUCKET_SUFFIXES,
    FIREBASE_EMULATOR_PROJECT_ID: 'demo-roar',
    artifactBucketName: (projectId, assessment) => `${projectId}-${ARTIFACT_BUCKET_SUFFIXES[assessment]}`,
  };
});
vi.mock('@roar-platform/assessment-schema', () => schema);
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

const { execFileSync } = await import('node:child_process');
const { documentsDir, download, recordings } = await import('./recordings.mjs');

const BUCKET_PREFIX = 'roar-readaloud/p/p/a/r';
const newest = { name: `${BUCKET_PREFIX}/newest.webm`, timeCreated: '2026-02-01T00:00:00Z', size: '20' };
const older = { name: `${BUCKET_PREFIX}/older.webm`, timeCreated: '2026-01-01T00:00:00Z', size: '10' };

/** Serves the listing, and fixed bytes for any object fetch. Records every URL. */
function stubFetch(items) {
  const urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      urls.push(url);
      if (url.includes('/storage/v1/b/')) return { ok: true, json: async () => ({ items }) };
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode('bytes').buffer };
    }),
  );
  return urls;
}

/** Runs the command, capturing UI output. */
async function run(args, items) {
  const urls = stubFetch(items);
  const lines = [];
  const ui = { info: (m) => lines.push(m), error: (m) => lines.push(m) };
  await recordings(ui, args);
  return { out: lines.join('\n'), urls };
}

/** Every file under a directory, as paths relative to it. */
function filesUnder(dir) {
  return readdirSync(dir, { recursive: true })
    .map((entry) => path.join(dir, String(entry)))
    .filter((candidate) => statSync(candidate).isFile())
    .map((candidate) => path.relative(dir, candidate));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.exitCode = undefined;
});

describe('listing filter', () => {
  it('lists a well-formed recording', async () => {
    const { out } = await run(['ls'], [newest]);
    expect(out).toContain('newest.webm');
    expect(out).toContain('1 recording(s)');
  });

  it.each([
    ['traversal', '../../../../home/dev/.bashrc'],
    ['nested traversal', 'roar-readaloud/../../../etc/passwd.webm'],
    ['absolute path', '/etc/cron.d/payload.webm'],
    ['backslash separator', 'roar-readaloud\\..\\..\\evil.webm'],
    ['single-dot segment', 'roar-readaloud/./take.webm'],
    ['html, which picks a browser handler', `${BUCKET_PREFIX}/notes.html`],
    ['desktop entry', `${BUCKET_PREFIX}/launch.desktop`],
    ['no extension', `${BUCKET_PREFIX}/take`],
    ['bucket metadata entry', `${BUCKET_PREFIX}/take.webm.bucketMetadata`],
  ])('rejects %s', async (_label, name) => {
    const { out } = await run(['ls'], [{ ...newest, name }]);
    expect(out).not.toContain(name);
    expect(out).toMatch(/No recordings yet/);
  });

  it('accepts an uppercase extension', async () => {
    const { out } = await run(['ls'], [{ ...newest, name: `${BUCKET_PREFIX}/TAKE.WEBM` }]);
    expect(out).toContain('TAKE.WEBM');
  });

  it('keeps the safe entry when a listing mixes safe and unsafe names', async () => {
    const { out } = await run(['ls'], [{ ...newest, name: '../escape.webm' }, newest]);
    expect(out).toContain('newest.webm');
    expect(out).not.toContain('escape.webm');
    expect(out).toContain('1 recording(s)');
  });
});

describe('flag and subcommand parsing', () => {
  it('rejects an unknown subcommand without listing anything', async () => {
    const { out, urls } = await run(['delete'], [newest]);
    expect(out).toContain('Unknown subcommand "delete"');
    expect(process.exitCode).toBe(1);
    expect(urls).toHaveLength(0);
  });

  it.each([['--export-al'], ['--all'], ['--bogus']])('rejects the unknown flag %s on latest', async (flag) => {
    const { out, urls } = await run(['latest', flag], [newest]);
    expect(out).toContain(`Unknown flag(s): ${flag}`);
    expect(out).toContain('--export, --export-all');
    expect(process.exitCode).toBe(1);
    // Rejected before the listing, so a malformed call behaves the same on an empty bucket.
    expect(urls).toHaveLength(0);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('rejects any flag on ls, which takes none', async () => {
    const { out } = await run(['ls', '--export'], [newest]);
    expect(out).toContain('ls takes no flags');
    expect(process.exitCode).toBe(1);
  });

  it('opens the newest recording when no export flag is given', async () => {
    const { out } = await run(['latest'], [newest, older]);
    expect(out).toContain('Opened roar-readaloud/p/p/a/r/newest.webm');
    expect(execFileSync).toHaveBeenCalledTimes(1);

    // Into a private directory, not a predictable os.tmpdir()/<basename>.
    const [, [opened]] = execFileSync.mock.calls[0];
    expect(path.dirname(opened)).toMatch(/roar-recordings-/);
    expect(path.basename(opened)).toBe('newest.webm');
  });
});

describe('export', () => {
  it('--export writes only the newest, --export-all writes every recording', async () => {
    const one = mkdtempSync(path.join(os.tmpdir(), 'rec-one-'));
    await run(['latest', '--export', one], [newest, older]);
    const exportedOne = filesUnder(one);
    expect(exportedOne).toHaveLength(1);
    expect(exportedOne[0]).toContain('newest.webm');

    const all = mkdtempSync(path.join(os.tmpdir(), 'rec-all-'));
    const { out } = await run(['latest', '--export-all', all], [newest, older]);
    expect(out).toContain('Exported 2 recording(s)');
    expect(filesUnder(all)).toHaveLength(2);
  });

  it('writes a timestamped subdirectory so successive exports stay comparable', async () => {
    const dest = mkdtempSync(path.join(os.tmpdir(), 'rec-stamp-'));
    await run(['latest', '--export', dest], [newest]);

    const [stamp] = readdirSync(path.join(dest, 'roar-recordings'));
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps every written file inside the destination', async () => {
    const dest = mkdtempSync(path.join(os.tmpdir(), 'rec-contain-'));
    await run(['latest', '--export-all', dest], [newest, older]);

    for (const relative of filesUnder(dest)) {
      expect(relative.startsWith('..')).toBe(false);
      expect(path.isAbsolute(relative)).toBe(false);
    }
    expect(
      readFileSync(
        path.join(dest, 'roar-recordings', readdirSync(path.join(dest, 'roar-recordings'))[0], newest.name),
        'utf8',
      ),
    ).toBe('bytes');
  });

  it('percent-encodes each object-name segment in the download URL', async () => {
    // `%` survives the SDK's sanitizer, and the listing reports whatever is in the
    // bucket — unencoded, `take%41.webm` would request `takeA.webm`.
    const dest = mkdtempSync(path.join(os.tmpdir(), 'rec-encode-'));
    const tricky = { ...newest, name: `${BUCKET_PREFIX}/take%41 one.webm` };
    const { urls } = await run(['latest', '--export', dest], [tricky]);

    const objectUrl = urls.find((url) => !url.includes('/storage/v1/b/'));
    expect(objectUrl).toContain('take%2541%20one.webm');
    // Separators survive encoding, so the object path is still a path.
    expect(objectUrl).toContain(`/${BUCKET_PREFIX}/`);
  });
});

describe('download', () => {
  const BUCKET = 'demo-roar-readaloud';

  it('refuses a target outside the destination root, before requesting anything', async () => {
    // The listing filter rejects traversal first, so this assertion is only reachable by calling
    // download directly — which is also how a future caller that skips the filter would reach it.
    const root = mkdtempSync(path.join(os.tmpdir(), 'rec-root-'));
    const escaping = '../escape.webm';
    const urls = stubFetch([]);

    await expect(download(BUCKET, escaping, path.join(root, escaping), root)).rejects.toThrow(
      /Refusing to write outside/,
    );
    expect(urls).toHaveLength(0);
    expect(existsSync(path.resolve(root, escaping))).toBe(false);
  });

  it('writes a target inside the root, creating its parent directories', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'rec-inside-'));
    const name = `${BUCKET_PREFIX}/take.webm`;
    stubFetch([]);

    await download(BUCKET, name, path.join(root, name), root);

    expect(readFileSync(path.join(root, name), 'utf8')).toBe('bytes');
  });
});

describe('documentsDir', () => {
  it('uses the localized directory xdg-user-dir reports', () => {
    // ~/Documents is localized, so the name is asked for rather than assumed.
    const localized = mkdtempSync(path.join(os.tmpdir(), 'rec-docs-'));
    execFileSync.mockReturnValueOnce(`${localized}\n`);

    expect(documentsDir()).toBe(localized);
  });

  it('falls back when xdg-user-dir names a directory that is not there', () => {
    execFileSync.mockReturnValueOnce('/nonexistent/Documents\n');

    const resolved = documentsDir();

    expect(resolved).not.toBe('/nonexistent/Documents');
    expect(existsSync(resolved)).toBe(true);
  });

  it('falls back when xdg-user-dir is absent, as it is on macOS', () => {
    execFileSync.mockImplementationOnce(() => {
      throw new Error('spawnSync xdg-user-dir ENOENT');
    });

    expect(existsSync(documentsDir())).toBe(true);
  });
});
