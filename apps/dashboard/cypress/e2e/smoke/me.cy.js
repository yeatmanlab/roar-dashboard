/**
 * Smoke test for the seeded local-backend pipeline.
 *
 * This spec proves that, with the e2e-tests CI job's service containers up,
 * the full chain functions end-to-end:
 *
 *   Cypress
 *     → Firebase Auth emulator   (mint a real ID token for a seeded user)
 *     → ROAR backend `/v1/me`    (verify token via FirebaseAuthProvider with
 *                                  FIREBASE_AUTH_EMULATOR_HOST set)
 *     → Postgres + OpenFGA       (resolve the user's record + permissions)
 *
 * The dashboard UI is NOT exercised here — that lives in per-domain
 * migration PRs (see `.ai/rules/frontend-e2e-testing-pattern.md`). The Vite
 * preview boot is implicitly validated by the cypress-io action's `wait-on`
 * step before this spec runs.
 *
 * If this spec fails, troubleshoot in this order:
 *   1. `wait-on` on backend / emulator timed out in CI → service container
 *      or background process didn't start. Check the job logs.
 *   2. Sign-in returns 4xx → emulator user wasn't seeded (server-test
 *      didn't run `seedFirebaseAuthEmulator`, or the fixture file path
 *      doesn't match `CYPRESS_FIXTURE_FILE`).
 *   3. `/v1/me` returns 401 → backend isn't running in emulator mode (the
 *      `FIREBASE_AUTH_EMULATOR_HOST` env var didn't reach `server-test`).
 *   4. `/v1/me` returns 200 but with the wrong user → seeder UID drift.
 */

import { signInAs } from '../../support/api-helpers';

const FIXTURE_FILE = Cypress.env('FIXTURE_FILE') ?? '/tmp/roar-cypress-fixture.json';
const ROAR_API_BASE_URL = Cypress.env('ROAR_API_BASE_URL') ?? 'http://127.0.0.1:4000';

describe('Smoke: seeded local-backend pipeline', () => {
  let fixture;

  before(() => {
    cy.readFile(FIXTURE_FILE).then((data) => {
      fixture = data;
      expect(fixture, 'cypress fixture').to.have.nested.property('users.schoolATeacher.email');
    });
  });

  it('mints an emulator ID token and /me returns the seeded teacher', () => {
    const teacher = fixture.users.schoolATeacher;

    signInAs(teacher, { expectedAuthId: teacher.authId })
      .then((idToken) => {
        return cy.request({
          method: 'GET',
          url: `${ROAR_API_BASE_URL}/v1/me`,
          headers: { Authorization: `Bearer ${idToken}` },
        });
      })
      .then((meRes) => {
        expect(meRes.status, 'GET /v1/me status').to.eq(200);
        expect(meRes.body.data.id, 'me.id matches seeded teacher.id').to.eq(teacher.id);
        expect(meRes.body.data.nameFirst, 'me.nameFirst matches seed').to.eq(teacher.nameFirst);
        expect(meRes.body.data.nameLast, 'me.nameLast matches seed').to.eq(teacher.nameLast);
      });
  });

  it('rejects an unauthenticated /me request with 401', () => {
    cy.request({
      method: 'GET',
      url: `${ROAR_API_BASE_URL}/v1/me`,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status, 'GET /v1/me without bearer').to.eq(401);
    });
  });
});
