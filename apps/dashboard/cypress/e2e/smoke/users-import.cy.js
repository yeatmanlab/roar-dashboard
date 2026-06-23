/**
 * Backend-only e2e proofs for POST /v1/users/import against the seeded local
 * stack (Postgres + OpenFGA + Firebase Auth emulator + server-test.ts). These
 * exercise the two things the unit/integration suites and mocks structurally
 * cannot prove:
 *
 *   1. The SCRYPT password hash written via `importUsers` actually verifies at
 *      sign-in (the "every imported student is locked out" risk). The
 *      known-answer unit test proves our hash matches Firebase's published
 *      vector; only a real importUsers → signInWithPassword round-trip proves
 *      the payload wiring.
 *   2. Membership reconciliation on the update bin flips real OpenFGA
 *      authorization in BOTH directions — an added membership grants access, a
 *      removed one revokes it. Unit tests assert the tuples we *send*; only a
 *      live FGA `check` proves they *evaluate* to the right allow/deny.
 *
 * The dashboard UI is not exercised here. See `.ai/rules/frontend-e2e-testing-pattern.md`.
 */

const FIXTURE_FILE = Cypress.env('FIXTURE_FILE') ?? '/tmp/roar-cypress-fixture.json';
const EMULATOR_HOST = Cypress.env('FIREBASE_AUTH_EMULATOR_HOST') ?? '127.0.0.1:9099';
const ROAR_API_BASE_URL = Cypress.env('ROAR_API_BASE_URL') ?? 'http://127.0.0.1:4000';

// The emulator accepts any non-empty `key`; its tokens aren't signed.
const EMULATOR_API_KEY = 'fake-api-key';

/** Sign in via the Auth emulator and yield the ID token. */
function signInToken(email, password) {
  return cy
    .request({
      method: 'POST',
      url: `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${EMULATOR_API_KEY}`,
      body: { email, password, returnSecureToken: true },
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, `emulator sign-in for ${email}`).to.eq(200);
      expect(res.body.idToken, 'idToken').to.be.a('string').and.not.empty;
      return res.body.idToken;
    });
}

/** POST /v1/users/import with a bearer token. */
function importUsers(token, rows) {
  return cy.request({
    method: 'POST',
    url: `${ROAR_API_BASE_URL}/v1/users/import`,
    headers: { Authorization: `Bearer ${token}` },
    body: { users: rows },
    failOnStatusCode: false,
  });
}

/** GET a backend resource with a bearer token, without failing on 4xx. */
function authGet(token, path) {
  return cy.request({
    method: 'GET',
    url: `${ROAR_API_BASE_URL}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });
}

describe('Smoke: bulk import → emulator sign-in (SCRYPT hash verifies)', () => {
  // Unique per run so a re-run against a non-reset emulator can't collide.
  const newUser = {
    email: `import-signin-${Date.now()}@example.org`,
    password: 'ImportProof123',
    nameFirst: 'Imported',
    nameLast: 'Student',
  };
  let superToken;
  let createdUserId;

  before(() => {
    cy.readFile(FIXTURE_FILE)
      .then((fixture) => {
        // Super admin can call the import endpoint (bypasses FGA).
        return signInToken(fixture.users.superAdmin.email, fixture.users.superAdmin.password);
      })
      .then((token) => {
        superToken = token;
        // The create row requires ≥1 membership — borrow any real school id.
        return authGet(superToken, '/v1/schools?perPage=1');
      })
      .then((res) => {
        expect(res.status, 'list schools').to.eq(200);
        const schoolId = res.body.data.items[0].id;
        return importUsers(superToken, [
          {
            email: newUser.email,
            password: newUser.password,
            name: { first: newUser.nameFirst, last: newUser.nameLast },
            userType: 'student',
            memberships: [{ entityType: 'school', entityId: schoolId, role: 'student' }],
          },
        ]);
      })
      .then((res) => {
        expect(res.status, 'import status').to.eq(200);
        expect(res.body.data.summary.created, 'created count').to.eq(1);
        const row = res.body.data.results[0];
        expect(row.status, `row outcome: ${JSON.stringify(row.error ?? {})}`).to.eq('ok');
        expect(row.classification).to.eq('created');
        createdUserId = row.id;
      });
  });

  it('creates the Firebase + DB records (verified via a super-admin read)', () => {
    // Guaranteed regardless of the emulator's SCRYPT support: proves the
    // importUsers payload wiring + DB persistence end-to-end.
    authGet(superToken, `/v1/users/${createdUserId}`).then((res) => {
      expect(res.status, 'GET imported user').to.eq(200);
      expect(res.body.data.email).to.eq(newUser.email);
    });
  });

  it('the imported password verifies end-to-end (emulator sign-in + /me)', () => {
    // Headline lock-out proof: the SCRYPT hash written via importUsers must
    // verify at sign-in. If this reds with a 4xx sign-in, the Firebase Auth
    // emulator does not recompute Firebase-scrypt for imported users (the
    // existing emulator seeder uses plaintext createUser, so this is the first
    // place importUsers-against-emulator is exercised). The hashing algorithm
    // itself stays pinned by the firebase-password-hash known-answer unit test;
    // if the emulator is the limitation, downgrade this to an emulator
    // account-existence check rather than treating it as an import regression.
    signInToken(newUser.email, newUser.password)
      .then((token) => authGet(token, '/v1/me'))
      .then((meRes) => {
        expect(meRes.status, 'GET /v1/me as the imported user').to.eq(200);
        expect(meRes.body.data.id, 'me.id matches the imported user').to.eq(createdUserId);
      });
  });
});

describe('Smoke: bulk import update → membership reconcile → OpenFGA reflects access', () => {
  let superToken;
  let adminToken;
  let admin; // the schoolAAdmin fixture user (plaintext-seeded — emulator-scrypt-independent)
  let schoolX; // the school the admin currently belongs to
  let schoolY; // a different school the admin will be reconciled into

  before(() => {
    cy.readFile(FIXTURE_FILE)
      .then((fixture) => {
        admin = fixture.users.schoolAAdmin;
        return signInToken(fixture.users.superAdmin.email, fixture.users.superAdmin.password);
      })
      .then((token) => {
        superToken = token;
        return signInToken(admin.email, admin.password);
      })
      .then((token) => {
        adminToken = token;
        // A school admin can read exactly the school(s) they belong to.
        return authGet(adminToken, '/v1/schools');
      })
      .then((res) => {
        expect(res.status, 'admin lists own schools').to.eq(200);
        expect(res.body.data.items.length, 'admin belongs to a school').to.be.greaterThan(0);
        schoolX = res.body.data.items[0].id;
        // Pick a different school (from the super-admin-wide list) to move into.
        return authGet(superToken, '/v1/schools');
      })
      .then((res) => {
        expect(res.status, 'super admin lists all schools').to.eq(200);
        const other = res.body.data.items.find((s) => s.id !== schoolX);
        expect(other, 'a second school exists to reconcile into').to.exist;
        schoolY = other.id;
      });
  });

  it('baseline: the admin can read their school but is denied the target school', () => {
    authGet(adminToken, `/v1/schools/${schoolX}`).then((res) => expect(res.status, 'reads own school').to.eq(200));
    authGet(adminToken, `/v1/schools/${schoolY}`).then((res) =>
      expect(res.status, 'denied on the not-yet-member school').to.eq(403),
    );
  });

  it('reconcile moves the admin from schoolX to schoolY and OpenFGA reflects both directions', () => {
    // Replace-semantics update: providing only schoolY for the school entity
    // type ends the schoolX membership and adds schoolY.
    importUsers(superToken, [
      {
        email: admin.email,
        name: { first: admin.nameFirst, last: admin.nameLast },
        userType: admin.userType,
        memberships: [{ entityType: 'school', entityId: schoolY, role: 'administrator' }],
      },
    ])
      .then((res) => {
        expect(res.status, 'import status').to.eq(200);
        const row = res.body.data.results[0];
        expect(row.classification, 'routed to the update bin').to.eq('updated');
        expect(row.status, `update outcome: ${JSON.stringify(row.error ?? {})}`).to.eq('ok');
        // Removed membership → access revoked in FGA (the delete-tuple path).
        return authGet(adminToken, `/v1/schools/${schoolX}`);
      })
      .then((res) => {
        expect(res.status, 'revoked on the removed school').to.eq(403);
        // Added membership → access granted in FGA (the write-tuple path).
        return authGet(adminToken, `/v1/schools/${schoolY}`);
      })
      .then((res) => {
        expect(res.status, 'granted on the added school').to.eq(200);
      });
  });
});
