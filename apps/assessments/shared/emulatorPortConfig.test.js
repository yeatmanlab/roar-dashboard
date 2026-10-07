// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIREBASE_EMULATOR_AUTH_HOST, FIREBASE_EMULATOR_STORAGE_HOST } from './devEmulatorHost.cjs';

/**
 * The Emulator UI is a browser-side app: it builds auth/storage URLs from the
 * ports the emulator config advertises, not from Docker's published ports. If
 * the assessment stack shifted its ports at the Docker boundary (9097:9099),
 * the UI at :9002 would query 127.0.0.1:9099 — the PLATFORM stack's emulator —
 * and silently display the wrong stack's users. The ports must therefore be
 * shifted in firebase.assessment.json itself and published 1:1.
 *
 * This spec pins the agreement between the three places that carry the ports:
 * devEmulatorHost.cjs (what dev bundles connect to), firebase.assessment.json
 * (what the emulators bind and the UI advertises), and
 * docker-compose.assessment.yml (what Docker publishes and the backend targets).
 */

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const emulatorConfig = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'docker', 'firebase-emulator', 'firebase.assessment.json'), 'utf8'),
);
const compose = readFileSync(path.join(REPO_ROOT, 'docker-compose.assessment.yml'), 'utf8');

const AUTH_PORT = Number(FIREBASE_EMULATOR_AUTH_HOST.split(':')[1]);
const STORAGE_PORT = Number(FIREBASE_EMULATOR_STORAGE_HOST.split(':')[1]);

describe('assessment emulator port agreement', () => {
  it('firebase.assessment.json binds the ports dev bundles connect to', () => {
    expect(emulatorConfig.emulators.auth.port).toBe(AUTH_PORT);
    expect(emulatorConfig.emulators.storage.port).toBe(STORAGE_PORT);
  });

  it('docker-compose publishes the auth and storage ports 1:1', () => {
    // Published ports are loopback-bound; the mapping itself must be identity.
    expect(compose).toMatch(new RegExp(`"(?:127\\.0\\.0\\.1:)?${AUTH_PORT}:${AUTH_PORT}"`));
    expect(compose).toMatch(new RegExp(`"(?:127\\.0\\.0\\.1:)?${STORAGE_PORT}:${STORAGE_PORT}"`));
  });

  it('docker-compose does not remap the canonical ports at the Docker boundary', () => {
    // A mapping like "9097:9099" reintroduces the broken shape: the UI would
    // advertise 9099 and the browser would reach the platform stack instead.
    expect(compose).not.toMatch(/"(?:127\.0\.0\.1:)?\d+:9099"/);
    expect(compose).not.toMatch(/"(?:127\.0\.0\.1:)?\d+:9199"/);
  });

  it('the backend targets the auth emulator on the config port', () => {
    expect(compose).toContain(`FIREBASE_AUTH_EMULATOR_HOST: firebase-emulator:${AUTH_PORT}`);
  });

  it('the healthcheck probes both emulators on the config ports', () => {
    expect(compose).toContain(`http://localhost:${AUTH_PORT}/`);
    expect(compose).toContain(`http://localhost:${STORAGE_PORT}/`);
  });
});
