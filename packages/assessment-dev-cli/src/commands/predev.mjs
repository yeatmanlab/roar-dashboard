/**
 * `predev` hook — preflight for an assessment's `npm run dev`.
 *
 * `npm run dev` serves an assessment against whatever backend and Firebase
 * Auth emulator are already running. Two contexts satisfy that, and since the
 * two stacks bind disjoint host ports they can both be up at once:
 *   - the assessment environment (`npm start` brings its Docker stack up on
 *     9097/9197/4002, then runs `npm run dev`, which triggers this preflight), or
 *   - platform-context dev: the platform Docker stack on the canonical
 *     9099/9199 plus a host-run backend on 4000, opted into explicitly with
 *     FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev.
 *
 * Dev bundles default the emulator hosts to the assessment stack
 * (apps/assessments/shared/devEmulatorHost.cjs), so when a prerequisite is
 * missing the failures are otherwise silent — sign-in network errors, or 401s
 * on every /v1 request. Fail fast here and name the exact fix instead.
 *
 * Silent on success: this runs before every `npm run dev`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ASSESSMENT_AUTH_EMULATOR_HOST, ASSESSMENT_BACKEND_URL, REPO_ROOT } from '../context.mjs';
import { portInUse, probe } from '../net.mjs';

/** The platform stack's canonical emulator host and host-run backend. */
const PLATFORM_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const PLATFORM_BACKEND_URL = 'https://localhost:4000';

function fail(ui, headline, lines) {
  if (lines.length > 0) ui.note(lines.join('\n'), headline, 'error');
  else ui.error(headline);
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
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || ASSESSMENT_AUTH_EMULATOR_HOST;
  if (!(await probe(`http://${emulatorHost}/`))) {
    // A platform emulator on the canonical port usually means platform-context
    // dev that forgot the explicit opt-in.
    if (await probe(`http://${PLATFORM_AUTH_EMULATOR_HOST}/`)) {
      fail(ui, `No Firebase Auth emulator on ${emulatorHost}, but the platform stack's emulator is running`, [
        'Platform-context dev must opt in explicitly:',
        `  FIREBASE_AUTH_EMULATOR_HOST=${PLATFORM_AUTH_EMULATOR_HOST} npm run dev`,
        'Or start the assessment environment instead: npm start',
      ]);
      return;
    }
    fail(ui, `No Firebase Auth emulator on ${emulatorHost}`, [
      'Assessment environment: npm start',
      'Platform stack:         docker compose up -d --wait   (from the repo root)',
    ]);
    return;
  }

  // 3. The backend API. An exported BACKEND_URL (set by `npm start`, or by
  // hand) is authoritative for where the /v1 proxy points — probe exactly
  // that. Without it, the bundler default targets the platform's host-run TLS
  // backend on 4000.
  let backendScheme;
  const backendUrl = process.env.BACKEND_URL;
  if (backendUrl) {
    if (!(await probe(`${backendUrl.replace(/\/$/, '')}/health/live`))) {
      fail(ui, `No backend responds at BACKEND_URL (${backendUrl})`, [
        'Start it, or unset BACKEND_URL to use the platform default (https://localhost:4000).',
      ]);
      return;
    }
    backendScheme = backendUrl.split(':')[0];
  } else if (await probe(`${PLATFORM_BACKEND_URL}/health/live`)) {
    backendScheme = 'https';
  } else if (await probe(`${ASSESSMENT_BACKEND_URL}/health/live`)) {
    // The assessment stack is up, but without BACKEND_URL the proxy would
    // target the (absent) platform backend and fail every /v1 request.
    fail(ui, 'The assessment environment is running, but BACKEND_URL is not set', [
      'Use:  npm start   (sets BACKEND_URL for you)',
      `or:   BACKEND_URL=${ASSESSMENT_BACKEND_URL} npm run dev`,
    ]);
    return;
  } else {
    fail(ui, 'No backend is running', [
      'Assessment environment: npm start',
      'Platform context:       NODE_ENV=development npm run dev -w apps/backend',
    ]);
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
      fail(ui, 'The host-run backend is not configured for the Auth emulator', [
        'Add this line to apps/backend/.env, then restart the backend:',
        '',
        `  FIREBASE_AUTH_EMULATOR_HOST=${PLATFORM_AUTH_EMULATOR_HOST}`,
      ]);
    }
  }
}
