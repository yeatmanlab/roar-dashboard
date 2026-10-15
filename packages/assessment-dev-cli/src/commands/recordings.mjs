/**
 * Inspect recordings this assessment uploaded to the local GCS stand-in.
 *
 * Recordings live in a Docker named volume rather than a host directory — the
 * same convention as postgres-data and firebase-auth-data, which also means
 * `docker compose down -v` removes them with everything else. The tradeoff is
 * that they are not host-browsable, which is what these subcommands are for.
 *
 *   recordings ls                         list this assessment's recordings
 *   recordings latest                     open the newest one in the default viewer
 *   recordings latest --export [path]     copy it out instead of opening
 *   recordings latest --export-all [path] copy all of them out
 *
 * Scoped to the current assessment's bucket: ASSESSMENT_NAME comes from the calling
 * directory and resolves to a suffix via assessment-schema, so `npm run recordings:ls`
 * in roar-readaloud never shows another assessment's uploads. That import resolves to
 * the package's build output, so the workspace packages must be built first — `setup`
 * and `update` both do it, so in practice only a hand-run in a fresh clone hits it.
 *
 * macOS and Linux only. The CLI has no Windows path by decision, not oversight.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ARTIFACT_BUCKET_SUFFIXES,
  FIREBASE_EMULATOR_PROJECT_ID,
  artifactBucketName,
} from '@roar-platform/assessment-schema';
import { ASSESSMENT_GCS_PORT, ASSESSMENT_NAME } from '../context.mjs';

/**
 * Media extensions this command is willing to write to disk and hand to a desktop
 * opener. Mirrors the SDK's upload allowlist in generate-file-path.ts, which is
 * module-private there; kept in step by hand rather than by import, since the two
 * gate different things — that one what may be uploaded, this one what we will open.
 */
const ALLOWED_EXTENSIONS = new Set(['.webm', '.mp4', '.wav', '.ogg', '.mkv', '.mp3']);

const EXPORT_FLAG = '--export';
const EXPORT_ALL_FLAG = '--export-all';
const EXPORT_FLAGS = new Set([EXPORT_FLAG, EXPORT_ALL_FLAG]);

/**
 * Rejects object names that must not reach the filesystem or a desktop opener.
 *
 * Object names come from the stand-in's listing, which is a dev-local service that
 * will serve back whatever was written to it. Validating once here, at the boundary,
 * keeps every downstream use safe: `path.join(dest, name)` would otherwise follow
 * `../` out of the export directory, and the extension decides which application
 * `xdg-open` dispatches to.
 *
 * @param {string} name - Object name as reported by the listing.
 * @returns {boolean} true when the name is safe to write and open.
 */
function isSafeObjectName(name) {
  if (!name || path.isAbsolute(name) || name.includes('\\')) return false;
  if (name.split('/').some((segment) => segment === '..' || segment === '.')) return false;
  return ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/**
 * Percent-encodes an object name for use as a URL path.
 *
 * Encoded per segment so the `/` separators survive. The SDK strips `?`, `#`, `&`,
 * `=` and whitespace from every segment it composes, but not `%` — and the listing
 * reports whatever is actually in the bucket, not only what that path produced — so
 * an unencoded name can resolve to a different object or none at all.
 *
 * @param {string} name - Object name from the listing.
 * @returns {string} The name with each path segment percent-encoded.
 */
function encodeObjectName(name) {
  return name.split('/').map(encodeURIComponent).join('/');
}

/**
 * Resolves the user's documents directory, falling back to the home directory.
 *
 * `~/Documents` is localized, so the name is asked for rather than assumed —
 * otherwise exports land in a directory that does not exist on a non-English
 * system.
 *
 * @returns {string} An existing directory to export into.
 */
export function documentsDir() {
  try {
    const resolved = execFileSync('xdg-user-dir', ['DOCUMENTS'], { encoding: 'utf8' }).trim();
    if (resolved && existsSync(resolved)) return resolved;
  } catch {
    // xdg-user-dir is Linux-only and optional; fall through.
  }
  const conventional = path.join(os.homedir(), 'Documents');
  return existsSync(conventional) ? conventional : os.homedir();
}

/**
 * Fetches this assessment's objects from the GCS stand-in, newest first.
 *
 * Ordered by the API's `timeCreated` rather than file mtime, which is the
 * authoritative field and avoids reaching into the container.
 *
 * @param {string} bucket - Bucket to list.
 * @returns {Promise<Array<{name: string, timeCreated: string, size: string}>>}
 */
async function listObjects(bucket) {
  const endpoint = `http://127.0.0.1:${ASSESSMENT_GCS_PORT}`;
  const response = await fetch(`${endpoint}/storage/v1/b/${bucket}/o`);
  if (!response.ok) {
    throw new Error(`Could not list gs://${bucket} (HTTP ${response.status}). Is the stack running?`);
  }
  const { items = [] } = await response.json();
  return items
    .filter((item) => isSafeObjectName(item.name))
    .sort((a, b) => Date.parse(b.timeCreated) - Date.parse(a.timeCreated));
}

/**
 * Downloads one object to a local path, creating parent directories.
 *
 * `root` is asserted rather than assumed: `isSafeObjectName` already rejects
 * traversal at the listing boundary, but this function creates directories before
 * writing, so a future caller that skips that filter would otherwise have a write
 * primitive. Two checks for one invariant is the right trade here.
 *
 * @param {string} bucket - Source bucket.
 * @param {string} name - Object name.
 * @param {string} target - Local destination path.
 * @param {string} root - Directory the target must resolve inside.
 * @returns {Promise<void>}
 */
export async function download(bucket, name, target, root) {
  const resolved = path.resolve(target);
  if (resolved !== path.resolve(root) && !resolved.startsWith(path.resolve(root) + path.sep)) {
    throw new Error(`Refusing to write outside ${root}: ${name}`);
  }

  const response = await fetch(`http://127.0.0.1:${ASSESSMENT_GCS_PORT}/${bucket}/${encodeObjectName(name)}`);
  if (!response.ok) throw new Error(`Could not download ${name} (HTTP ${response.status}).`);
  mkdirSync(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

/**
 * Hands a file to the platform's default application.
 *
 * macOS and Linux only. Windows is deliberately unsupported — `start` is a cmd
 * builtin rather than an executable, so it would need its own `cmd /c` spelling,
 * and nobody on the team develops there.
 *
 * @param {string} target - Local file path.
 */
function openInViewer(target) {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFileSync(opener, [target], { stdio: 'ignore' });
}

export async function recordings(ui, args) {
  const [subcommand = 'ls', ...rest] = args;

  // The bucket is named from the assessment's SUFFIX, not its directory name — they
  // differ deliberately (roar-readaloud -> readaloud, roav-ran -> naming), which is
  // the whole point of the suffix living in assessment-schema. Composing it with the
  // package's own artifactBucketName, rather than re-spelling `<project>-<suffix>` here,
  // is what keeps dev pointed at the bucket the seeder created. The membership check is
  // what the composer cannot do: its parameter is typed, and this caller is JavaScript.
  if (!(ASSESSMENT_NAME in ARTIFACT_BUCKET_SUFFIXES)) {
    ui.error(`No artifact bucket suffix declared for "${ASSESSMENT_NAME}" in @roar-platform/assessment-schema.`);
    process.exitCode = 1;
    return;
  }
  const bucket = artifactBucketName(FIREBASE_EMULATOR_PROJECT_ID, ASSESSMENT_NAME);

  if (!['ls', 'latest'].includes(subcommand)) {
    ui.error(`Unknown subcommand "${subcommand}". Expected: ls, latest.`);
    process.exitCode = 1;
    return;
  }

  // Reject unrecognised flags rather than ignoring them: every flag here decides
  // whether a copy is kept, so a silently-dropped `--export-all` looks exactly like
  // a successful open — the wrong action, reported as success. Checked before the
  // listing so a malformed invocation fails the same way on an empty bucket.
  const allowedFlags = subcommand === 'latest' ? EXPORT_FLAGS : new Set();
  const unknownFlags = rest.filter((arg) => arg.startsWith('--') && !allowedFlags.has(arg));
  if (unknownFlags.length > 0) {
    const expected =
      allowedFlags.size > 0 ? `Expected: ${[...allowedFlags].join(', ')}.` : `${subcommand} takes no flags.`;
    ui.error(`Unknown flag(s): ${unknownFlags.join(', ')}. ${expected}`);
    process.exitCode = 1;
    return;
  }

  const objects = await listObjects(bucket);
  if (objects.length === 0) {
    ui.info(`No recordings yet for ${ASSESSMENT_NAME}. Play a trial, then try again.`);
    return;
  }

  if (subcommand === 'ls') {
    ui.info(`${objects.length} recording(s) in gs://${bucket}, newest first:`);
    for (const { name, timeCreated, size } of objects) {
      ui.info(`  ${timeCreated}  ${String(size).padStart(9)}  ${name}`);
    }
    return;
  }

  const exportAll = rest.includes(EXPORT_ALL_FLAG);
  const wantsExport = rest.includes(EXPORT_FLAG) || exportAll;
  const destArg = rest.find((arg) => !arg.startsWith('--'));

  if (!wantsExport) {
    // The common case: play a trial, check the recording, adjust, repeat. This is a
    // look-at-it action, so it lands in a temp directory rather than the documents
    // folder — `--export` is the one that keeps a copy. The directory is private and
    // per-invocation because a predictable os.tmpdir()/<basename> is both a symlink
    // target an attacker can pre-plant on a shared /tmp and a collision between two
    // recordings that happen to share a basename.
    const newest = objects[0];
    const scratch = await mkdtemp(path.join(os.tmpdir(), 'roar-recordings-'));
    const target = path.join(scratch, path.basename(newest.name));
    await download(bucket, newest.name, target, scratch);
    openInViewer(target);
    ui.info(`Opened ${newest.name} (${newest.timeCreated})`);
    return;
  }

  // One timestamped directory per export: the research loop runs this repeatedly,
  // and merging successive exports makes before/after comparison impossible.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  const dest = path.join(destArg ?? documentsDir(), 'roar-recordings', stamp);
  mkdirSync(dest, { recursive: true });

  const wanted = exportAll ? objects : [objects[0]];
  for (const { name } of wanted) {
    await download(bucket, name, path.join(dest, name), dest);
  }

  ui.info(`Exported ${wanted.length} recording(s) to ${dest}`);
}
