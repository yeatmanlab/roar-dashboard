/**
 * Backend-only smoke for the tasks-and-variants endpoints (T11).
 *
 * Mirrors `me.cy.js`: signs seeded fixture users in via the Firebase Auth
 * emulator and exercises the four read endpoints the dashboard's tasks
 * domain consumes, asserting the response envelope and authorization model:
 *
 *   GET /v1/tasks                   – any authenticated user
 *   GET /v1/tasks/:taskId/variants  – any authenticated user (published only)
 *   GET /v1/task-variants           – super admin or platform admin ONLY
 *   GET /v1/task-bundles            – super admin or platform admin ONLY
 *
 * The dashboard UI is NOT exercised here — see
 * `.ai/rules/frontend-e2e-testing-pattern.md` for the backend-only vs
 * dashboard-aware distinction.
 *
 * NOTE on positive catalog coverage: `CYPRESS_FIXTURE_USER_KEYS` in
 * `apps/backend/src/server-test.ts` currently seeds no super-admin or
 * platform-admin user, so the 200 path for `/v1/task-variants` and
 * `/v1/task-bundles` cannot be asserted here yet. Extending the fixture key
 * list (and `baseFixture`) with a `platformAdmin` entry is a backend change
 * tracked alongside the authz relaxation PR; add the 200 assertions when
 * that key exists.
 */

const FIXTURE_FILE = Cypress.env('FIXTURE_FILE') ?? '/tmp/roar-cypress-fixture.json';
const EMULATOR_HOST = Cypress.env('FIREBASE_AUTH_EMULATOR_HOST') ?? '127.0.0.1:9099';
const ROAR_API_BASE_URL = Cypress.env('ROAR_API_BASE_URL') ?? 'http://127.0.0.1:4000';

/**
 * The emulator accepts any non-empty value for `key` — its tokens aren't
 * cryptographically signed and `key` only exists for API surface parity
 * with production Identity Toolkit URLs.
 */
const EMULATOR_API_KEY = 'fake-api-key';

/**
 * Signs a fixture user in via the Auth emulator and yields their ID token.
 *
 * @param {Object} user – A fixture user entry ({ email, password, ... }).
 * @returns {Cypress.Chainable<string>} Chainable resolving to the ID token.
 */
function signInAs(user) {
  return cy
    .request({
      method: 'POST',
      url: `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${EMULATOR_API_KEY}`,
      body: {
        email: user.email,
        password: user.password,
        returnSecureToken: true,
      },
    })
    .then((authRes) => {
      expect(authRes.status, 'emulator sign-in status').to.eq(200);
      expect(authRes.body.idToken, 'idToken returned by emulator').to.be.a('string').and.not.empty;
      return cy.wrap(authRes.body.idToken, { log: false });
    });
}

describe('Smoke: tasks-and-variants endpoints', () => {
  let fixture;

  before(() => {
    cy.readFile(FIXTURE_FILE).then((data) => {
      fixture = data;
      expect(fixture, 'cypress fixture').to.have.nested.property('users.schoolATeacher.email');
      expect(fixture, 'cypress fixture').to.have.nested.property('users.districtAdmin.email');
    });
  });

  it('lists the seeded task catalog and a task’s variants for a teacher', () => {
    signInAs(fixture.users.schoolATeacher).then((idToken) => {
      cy.request({
        method: 'GET',
        url: `${ROAR_API_BASE_URL}/v1/tasks`,
        headers: { Authorization: `Bearer ${idToken}` },
      })
        .then((tasksRes) => {
          expect(tasksRes.status, 'GET /v1/tasks status').to.eq(200);
          expect(tasksRes.body.data.items, 'tasks envelope items').to.be.an('array').and.not.empty;
          expect(tasksRes.body.data.pagination, 'tasks envelope pagination').to.include.keys(
            'page',
            'perPage',
            'totalItems',
            'totalPages',
          );

          const task = tasksRes.body.data.items[0];
          expect(task, 'flat task shape').to.include.keys('id', 'slug', 'name', 'nameSimple', 'nameTechnical');

          return cy.request({
            method: 'GET',
            url: `${ROAR_API_BASE_URL}/v1/tasks/${task.id}/variants`,
            headers: { Authorization: `Bearer ${idToken}` },
          });
        })
        .then((variantsRes) => {
          expect(variantsRes.status, 'GET /v1/tasks/:taskId/variants status').to.eq(200);
          expect(variantsRes.body.data.items, 'variants envelope items').to.be.an('array').and.not.empty;
          const variant = variantsRes.body.data.items[0];
          expect(variant, 'flat variant shape').to.include.keys('id', 'taskId', 'status', 'taskName', 'taskSlug');
          // Non-super-admins only ever see published variants.
          variantsRes.body.data.items.forEach((item) => {
            expect(item.status, 'variant publication status').to.eq('published');
          });
        });
    });
  });

  it('denies a teacher access to the cross-task variant and bundle catalogs', () => {
    signInAs(fixture.users.schoolATeacher).then((idToken) => {
      ['/v1/task-variants', '/v1/task-bundles'].forEach((path) => {
        cy.request({
          method: 'GET',
          url: `${ROAR_API_BASE_URL}${path}`,
          headers: { Authorization: `Bearer ${idToken}` },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status, `GET ${path} as teacher`).to.eq(403);
          expect(res.body.error, `GET ${path} error envelope`).to.include.keys('message');
        });
      });
    });
  });

  it('denies a district admin (neither super nor platform admin) the same catalogs', () => {
    signInAs(fixture.users.districtAdmin).then((idToken) => {
      ['/v1/task-variants', '/v1/task-bundles'].forEach((path) => {
        cy.request({
          method: 'GET',
          url: `${ROAR_API_BASE_URL}${path}`,
          headers: { Authorization: `Bearer ${idToken}` },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status, `GET ${path} as district admin`).to.eq(403);
        });
      });
    });
  });

  it('rejects unauthenticated requests to all four endpoints with 401', () => {
    ['/v1/tasks', '/v1/tasks/some-task/variants', '/v1/task-variants', '/v1/task-bundles'].forEach((path) => {
      cy.request({
        method: 'GET',
        url: `${ROAR_API_BASE_URL}${path}`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status, `GET ${path} without bearer`).to.eq(401);
      });
    });
  });
});
