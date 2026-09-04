/**
 * Backend-only smoke test for the progress-report endpoints the dashboard's
 * Progress Report now consumes (it was cut over from Firestore to the ts-rest
 * backend). With the e2e-tests CI job's service containers up, this proves the
 * seeded stack serves progress data end-to-end:
 *
 *   Cypress
 *     → Firebase Auth emulator           (mint an ID token for schoolAAdmin)
 *     → GET /v1/administrations/:id/reports/progress/students
 *     → GET /v1/administrations/:id/reports/progress/overview
 *     → Postgres + OpenFGA + FDW runs    (scope auth + completion aggregation)
 *
 * The dashboard UI is NOT exercised here (no authenticated browser session
 * helper yet — see `.ai/rules/frontend-e2e-testing-pattern.md`); this is the
 * default backend-only path. The scenario IDs come from the `progress` block
 * `server-test` writes into the Cypress fixture file: the School A
 * administration is seeded with `schoolAStudent` completed and `classAStudent`
 * started, scoped to School A, and `schoolAAdmin` can read it.
 */

const FIXTURE_FILE = Cypress.env('FIXTURE_FILE') ?? '/tmp/roar-cypress-fixture.json';
const EMULATOR_HOST = Cypress.env('FIREBASE_AUTH_EMULATOR_HOST') ?? '127.0.0.1:9099';
const ROAR_API_BASE_URL = Cypress.env('ROAR_API_BASE_URL') ?? 'http://127.0.0.1:4000';
const EMULATOR_API_KEY = 'fake-api-key';

const signIn = (user) =>
  cy
    .request({
      method: 'POST',
      url: `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${EMULATOR_API_KEY}`,
      body: { email: user.email, password: user.password, returnSecureToken: true },
    })
    .then((authRes) => {
      expect(authRes.status, 'emulator sign-in status').to.eq(200);
      return authRes.body.idToken;
    });

const statusFor = (item, taskId) => item.progress?.[taskId]?.status;

describe('Smoke: progress-report endpoints over the seeded stack', () => {
  let fixture;
  let scenario;

  before(() => {
    cy.readFile(FIXTURE_FILE).then((data) => {
      fixture = data;
      expect(fixture, 'cypress fixture').to.have.nested.property('progress.schoolA.administrationId');
      scenario = fixture.progress.schoolA;
    });
  });

  it('returns per-student progress reflecting the seeded completion', () => {
    const admin = fixture.users[scenario.adminUserKey];

    signIn(admin).then((idToken) => {
      cy.request({
        method: 'GET',
        url: `${ROAR_API_BASE_URL}/v1/administrations/${scenario.administrationId}/reports/progress/students`,
        qs: { scopeType: scenario.scopeType, scopeId: scenario.scopeId, page: 1, perPage: 100 },
        headers: { Authorization: `Bearer ${idToken}` },
      }).then((res) => {
        expect(res.status, 'GET progress/students status').to.eq(200);

        const { items, tasks } = res.body.data;
        expect(tasks, 'tasks metadata for column rendering').to.be.an('array').and.have.length.greaterThan(0);
        expect(items, 'student rows').to.be.an('array').and.have.length.greaterThan(0);

        const completedRow = items.find((item) => item.user.userId === scenario.completedUserId);
        const startedRow = items.find((item) => item.user.userId === scenario.startedUserId);

        expect(completedRow, 'seeded completed student is present').to.exist;
        expect(startedRow, 'seeded started student is present').to.exist;

        const completedStatuses = Object.values(completedRow.progress).map((entry) => entry.status);
        const startedStatuses = Object.values(startedRow.progress).map((entry) => entry.status);

        expect(
          completedStatuses.some((status) => status.startsWith('completed')),
          'completed student has at least one completed task',
        ).to.be.true;
        expect(
          startedStatuses.some((status) => status.startsWith('started')),
          'started student has at least one started task',
        ).to.be.true;

        // Sanity: every task in a row carries one of the six visible statuses.
        const visible = new Set([
          'assigned-required',
          'assigned-optional',
          'started-required',
          'started-optional',
          'completed-required',
          'completed-optional',
        ]);
        items.forEach((item) => {
          Object.keys(item.progress).forEach((taskId) => {
            expect(visible.has(statusFor(item, taskId)), `valid status for task ${taskId}`).to.be.true;
          });
        });
      });
    });
  });

  it('returns an overview whose aggregate counts reflect the seeded completion', () => {
    const admin = fixture.users[scenario.adminUserKey];

    signIn(admin).then((idToken) => {
      cy.request({
        method: 'GET',
        url: `${ROAR_API_BASE_URL}/v1/administrations/${scenario.administrationId}/reports/progress/overview`,
        qs: { scopeType: scenario.scopeType, scopeId: scenario.scopeId },
        headers: { Authorization: `Bearer ${idToken}` },
      }).then((res) => {
        expect(res.status, 'GET progress/overview status').to.eq(200);

        const overview = res.body.data;
        expect(overview.totalStudents, 'totalStudents').to.be.greaterThan(0);
        expect(overview.byTask, 'per-task breakdown').to.be.an('array').and.have.length.greaterThan(0);
        expect(overview.studentsCompleted, 'at least one student completed').to.be.greaterThan(0);
        expect(
          overview.studentsAssigned + overview.studentsStarted + overview.studentsCompleted,
          'assignment buckets sum to studentsWithRequiredTasks',
        ).to.eq(overview.studentsWithRequiredTasks);
      });
    });
  });

  it('rejects an unauthenticated progress request', () => {
    cy.request({
      method: 'GET',
      url: `${ROAR_API_BASE_URL}/v1/administrations/${scenario.administrationId}/reports/progress/overview`,
      qs: { scopeType: scenario.scopeType, scopeId: scenario.scopeId },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status, 'unauthenticated overview request').to.eq(401);
    });
  });
});
