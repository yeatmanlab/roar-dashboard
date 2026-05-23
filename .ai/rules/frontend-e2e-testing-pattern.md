---
title: Frontend E2E Testing Pattern
description: How to write Cypress e2e specs after the legacy stack was retired. Specs run against a seeded local backend (Postgres + OpenFGA + Firebase Auth emulator + server-test.ts), not real dev Firebase. Migration PRs bring skipped specs back online by re-writing them under this pattern, not by porting them mechanically.
impact: HIGH
scope: frontend
tags: cypress, e2e, testing, auth, fixtures
---

## Frontend e2e testing pattern

The dashboard is migrating from `roarfirekit` + Cloud Functions + Firestore REST
to the new ts-rest backend. As of #1774 every legacy Cypress e2e spec under
`apps/dashboard/cypress/e2e/` is `describe.skip`-ed. Active specs run against
a fully local stack stood up by the `e2e-tests` CI job and bypass firekit
entirely — firekit is deprecated and will be removed once migration completes.

This rule is the contract migration PRs must follow when bringing a spec back
online. Reference implementation: `cypress/e2e/smoke/me.cy.js`.

### The local stack

The `e2e-tests` job in `.github/workflows/ci.yml` brings up:

| Service | How it's started | Reached at |
|---|---|---|
| Postgres | GitHub Actions service container | `postgres:5432` from backend; not directly from Cypress |
| OpenFGA | Background process from `openfga` binary | `127.0.0.1:8080` |
| Firebase Auth emulator | Background `firebase emulators:start --only auth` | `127.0.0.1:9099` |
| Backend (`server-test.ts`) | Background `node apps/backend/dist/server-test.js` | `127.0.0.1:4000` |
| Dashboard (Vite preview) | Started by the cypress-io action | `127.0.0.1:4173` |

`server-test.ts` seeds `baseFixture` (org hierarchy + users + administrations
+ task variants), syncs the FGA tuples that mirror it, and — when
`FIREBASE_AUTH_EMULATOR_HOST` is set — creates one Firebase Auth user per
fixture key in `CYPRESS_FIXTURE_USER_KEYS`, then writes
`/tmp/roar-cypress-fixture.json` with the credentials.

### The fixture file

Read once per spec via `cy.readFile`:

```js
const FIXTURE_FILE = Cypress.env('FIXTURE_FILE') ?? '/tmp/roar-cypress-fixture.json';

before(() => {
  cy.readFile(FIXTURE_FILE).then((data) => {
    fixture = data;
  });
});
```

Shape per user (one entry per key in `CYPRESS_FIXTURE_USER_KEYS` from
`apps/backend/src/server-test.ts`):

```json
{
  "users": {
    "schoolATeacher": {
      "id": "uuid",
      "authId": "uuid",
      "email": "<authId>@test.local",
      "password": "test-password-emulator",
      "nameFirst": "SchoolA",
      "nameLast": "Teacher",
      "userType": "educator"
    }
  }
}
```

Need a tier of user the fixture doesn't expose? Add the key to
`CYPRESS_FIXTURE_USER_KEYS` in the same PR — don't write specs that paper
over missing seed data with `cy.intercept`.

### Two kinds of e2e specs

Decide which one you're writing **before** un-skipping anything.

**Backend-only specs** — when the test is really about backend behavior
(authorization, scoring, embed resolution, error handling). Use `cy.request`
straight to `/v1/...` with a Bearer token minted from the Auth emulator.
Faster, more deterministic, and bypasses every dashboard concern.

**Dashboard-aware specs** — when the test is about UI behavior (a form
flow, a table interaction, a navigation guard). These need an authenticated
in-browser session, which means plumbing the emulator-issued token through
the dashboard's auth store around firekit. The first migration PR to need
this should introduce the helper (`cy.loginAsTestUser(fixtureKey)`) in
`cypress/support/commands.js`. Until then, prefer the backend-only path
where it covers the behavior under test.

### Incorrect

```js
// Re-using the legacy username/password helper against the new backend.
// `cy.login` clicks through the sign-in form, which posts to firekit, which
// expects real dev Firebase. None of that exists in the local stack.
describe('Score reports', () => {
  beforeEach(() => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
  });
  // ...
});

// Stubbing `/me` in the test even though server-test seeds a real one.
// Stubs let bad assumptions ride — the real backend response shape may
// differ from what the stub provides.
beforeEach(() => {
  cy.intercept('GET', /\/me/, { body: { data: { /* hand-rolled */ } } });
});

// Hardcoding emails/UIDs lifted from previous Firebase exports — the
// emulator UIDs change every CI run, since baseFixture regenerates them.
const PARTNER_ADMIN_UID = 'qwerty1234-real-uid';
```

### Correct

A backend-only smoke pattern (from `cypress/e2e/smoke/me.cy.js`):

```js
const FIXTURE_FILE = Cypress.env('FIXTURE_FILE') ?? '/tmp/roar-cypress-fixture.json';
const EMULATOR_HOST = Cypress.env('FIREBASE_AUTH_EMULATOR_HOST') ?? '127.0.0.1:9099';
const ROAR_API_BASE_URL = Cypress.env('ROAR_API_BASE_URL') ?? 'http://127.0.0.1:4000';

describe('Smoke: /me returns the seeded teacher', () => {
  let fixture;

  before(() => {
    cy.readFile(FIXTURE_FILE).then((data) => {
      fixture = data;
    });
  });

  it('signs in via the emulator and resolves /me', () => {
    const teacher = fixture.users.schoolATeacher;

    cy.request({
      method: 'POST',
      url: `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
      body: { email: teacher.email, password: teacher.password, returnSecureToken: true },
    })
      .then((authRes) => {
        return cy.request({
          method: 'GET',
          url: `${ROAR_API_BASE_URL}/v1/me`,
          headers: { Authorization: `Bearer ${authRes.body.idToken}` },
        });
      })
      .then((meRes) => {
        expect(meRes.body.data.id).to.eq(teacher.id);
      });
  });
});
```

### Bringing a skipped spec back online

1. **Open the spec and read what it covered.** If the behavior is now better
   expressed as a component test (no backend dependency, mounts a Vue
   component in isolation), delete the e2e spec and write a `.cy.js` next to
   the component instead.
2. **Decide backend-only vs dashboard-aware.** Backend-only is the default —
   reach for dashboard-aware only when the assertion is about what the user
   sees on screen.
3. **Re-write the spec body using the patterns above.** Don't port verbatim.
   Legacy specs assumed a long-running dev Firebase, stubbed `/me`, and
   relied on `cy.login` clicking through the UI; none of that applies any
   more.
4. **Remove the `.skip` from the top-level `describe` / `context`, and from
   any nested `describe.skip` in the same file.** The bulk skip pass in
   #1774 added `.skip` at every depth; partial un-skip just confuses the
   next reader.
5. **If the spec needs a new fixture user**, extend `CYPRESS_FIXTURE_USER_KEYS`
   in `apps/backend/src/server-test.ts` (and confirm the key exists on
   `baseFixture`).
6. **If the spec needs the dashboard auth helper that doesn't exist yet**,
   add it in the same PR — don't ship a "TODO: build the helper" comment.

### Component tests are unaffected

Component tests under `apps/dashboard/src/**/*.cy.js` mount Vue components
in isolation and don't depend on a backend at all. The migration cutover
doesn't touch them.

### The principle

Stubs and clicked-through login flows let specs pass against a fictitious
world — they decouple test coverage from real backend behavior, which is
exactly the opposite of what an e2e suite should do. A seeded local stack
removes the temptation. Migration PRs that re-introduce specs by following
this pattern protect us from drift between what the dashboard expects and
what the backend actually returns.
