/**
 * `predev` hook — preflight for an assessment's `npm run dev`.
 *
 * `npm run dev` serves an assessment against whatever backend and Firebase
 * Auth emulator are already running. Two contexts satisfy that:
 *   - the assessment environment (`npm start` brings its Docker stack up, then
 *     runs `npm run dev`, which triggers this preflight), or
 *   - platform-context dev: the platform Docker stack (repo root
 *     `docker compose up -d --wait`) plus a host-run backend
 *     (`NODE_ENV=development npm run dev -w apps/backend`).
 *
 * Dev bundles default FIREBASE_AUTH_EMULATOR_HOST to the local emulator
 * (apps/assessments/shared/devEmulatorHost.cjs), so when a prerequisite is
 * missing the failures are otherwise silent — sign-in network errors, or 401s
 * on every /v1 request. Fail fast here and name the exact fix instead.
 *
 * Silent on success: this runs before every `npm run dev`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../context.mjs';
import { portInUse, probe } from '../net.mjs';

function fail(ui, headline, lines, noteTitle) {
  ui.error(headline);
  if (lines.length > 0) ui.note(lines.join('\n'), noteTitle);
  process.exitCode = 1;
}

export async function predev(ui) {
  // 1. The dev server's own port.
  if (portInUse('8000')) {
    fail(ui, 'Port 8000 is already in use.', [
      'A previous dev server (or another assessment) is still running — stop it first.',
    ]);
    return;
  }

  // 2. The Firebase Auth emulator. An exported FIREBASE_AUTH_EMULATOR_HOST
  // overrides the bundler default, so probe the host the dev bundle will
  // actually use.
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  if (!(await probe(`http://${emulatorHost}/`))) {
    fail(
      ui,
      `No Firebase Auth emulator on ${emulatorHost}.`,
      [
        'Assessment environment: npm start',
        'Platform context:       docker compose up -d --wait   (from the repo root)',
      ],
      'Start one first',
    );
    return;
  }

  // 3. The backend API. An exported BACKEND_URL (set by `npm start`, or by
  // hand) is authoritative for where the /v1 proxy points — probe exactly
  // that. Without it, probe the default localhost:4000; there the scheme
  // identifies the context: the containerized assessment-env backend serves
  // plain HTTP, a host-run dev backend serves TLS (mkcert) unconditionally.
  let backendScheme;
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    if (!(await probe(`${backendUrl.replace(/\/$/, '')}/health/live`))) {
      fail(ui, `No backend responds at BACKEND_URL (${backendUrl}).`, [
        'Start it, or unset BACKEND_URL to use the default localhost:4000.',
      ]);
      return;
    }
    backendScheme = backendUrl.split(':')[0];
  } else if (await probe('http://localhost:4000/health/live')) {
    // The bundler configs default the /v1 proxy to https://localhost:4000
    // (the host-run backend). Against this containerized HTTP backend that
    // default fails the TLS handshake on every request; `npm start` exports
    // BACKEND_URL, a direct `npm run dev` must do the same.
    fail(ui, 'The backend on localhost:4000 serves plain HTTP, but BACKEND_URL is not set.', [
      'The dev-server proxy would default to https:// and fail every /v1 request.',
      'Use:  npm start   (sets BACKEND_URL for you)',
      'or:   BACKEND_URL=http://localhost:4000 npm run dev',
    ]);
    return;
  } else if (await probe('https://localhost:4000/health/live')) {
    backendScheme = 'https';
  } else {
    fail(
      ui,
      'No backend on localhost:4000.',
      ['Assessment environment: npm start', 'Platform context:       NODE_ENV=development npm run dev -w apps/backend'],
      'Start one first',
    );
    return;
  }

  // 4. Platform context only: emulator token verification. The backend
  // verifies tokens against the Auth emulator only when
  // FIREBASE_AUTH_EMULATOR_HOST is set in its environment (see
  // apps/backend/src/clients/firebase-core.client.ts). Without it, the
  // assessment signs in against the emulator while the backend verifies
  // against real Firebase, and every /v1 request 401s with no hint of why.
  // The containerized backend sets the variable in compose; only the host-run
  // backend can miss it. An exported FIREBASE_AUTH_EMULATOR_HOST counts as
  // configured — like the .env check, it signals intent; neither can inspect
  // the running backend's env.
  if (backendScheme === 'https' && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const backendEnv = path.join(REPO_ROOT, 'apps', 'backend', '.env');
    const configured =
      existsSync(backendEnv) && /^FIREBASE_AUTH_EMULATOR_HOST=.+/m.test(readFileSync(backendEnv, 'utf8'));
    if (!configured) {
      fail(
        ui,
        'The host-run backend is not configured for the Auth emulator.',
        [`FIREBASE_AUTH_EMULATOR_HOST=${emulatorHost}`],
        'Add this line to apps/backend/.env, then restart the backend',
      );
    }
  }
}
