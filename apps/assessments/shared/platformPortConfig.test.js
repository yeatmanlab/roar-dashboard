// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Port agreement for the platform dev stack's Cloud Storage stand-in.
 *
 * `-public-host` is baked into the signed upload URL the browser follows, so it must
 * carry the port Docker publishes rather than the container port. A mismatch is silent:
 * both stacks' fake-gcs accept any signed PUT, so uploads would simply land in the
 * wrong stack. The assessment stack has the same assertion in emulatorPortConfig.test.js;
 * this is its platform-stack counterpart, which was otherwise unguarded.
 */
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const compose = readFileSync(path.join(REPO_ROOT, 'docker-compose.yml'), 'utf8');

describe('platform stack fake-gcs port agreement', () => {
  it('publishes and advertises the same overridable port', () => {
    expect(compose).toMatch(/- "127\.0\.0\.1:\$\{ROAR_GCS_PORT:-4443\}:4443"/);
    expect(compose).toContain('-public-host 127.0.0.1:${ROAR_GCS_PORT:-4443}');
  });

  it('probes the healthcheck with wget, not curl', () => {
    // The fake-gcs-server image is Alpine-based and ships no curl; a curl probe exits
    // 127, so the container never reports healthy and dependents never start.
    const healthcheck = compose.slice(compose.indexOf('fake-gcs:'));
    expect(healthcheck).toMatch(/test: \["CMD-SHELL", "wget /);
    expect(healthcheck.slice(0, healthcheck.indexOf('\nvolumes:'))).not.toMatch(/"curl /);
  });
});
