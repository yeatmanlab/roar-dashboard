# Cypress E2E specs

Every spec in this directory is `describe.skip`-ed (or `context.skip`-ed) at
the file level. The specs in their committed form were written against:

- Real dev Firebase Auth + Firestore for authentication and data
- The previous Cloud Functions / `roarfirekit` / Firestore REST data layer
- A default `/me` `cy.intercept` stub in `cypress/support/e2e.js` so the
  dashboard's `useMeQuery` would resolve in the absence of a reachable
  backend

The dashboard now talks to the ts-rest backend, and the `e2e-tests` CI job
stands up a seeded local stack (`apps/backend/src/server-test.ts` plus a
Firebase Auth emulator) that real specs run against. The pre-existing specs
stay skipped until someone re-writes them under the new architecture — not
because the workflows they cover aren't worth testing, but because the
mechanics of the legacy specs don't translate.

## How to bring a spec back online

1. Read `.ai/rules/frontend-e2e-testing-pattern.md` for the contract:
   what to authenticate with, which seeded fixture users are available,
   how to talk to the local backend, and the difference between component
   tests (kept as-is) and e2e tests (re-written one at a time).
2. Decide whether the spec is still the right level of coverage. Many of
   the legacy specs are better expressed as component tests now that the
   container/presentational split is wider — don't reach for an e2e spec
   if a component test would do.
3. Replace the spec's body with the new pattern. For **backend-only** specs
   (authorization, error handling, score correctness), reach for `cy.request`
   directly — see `cypress/e2e/smoke/me.cy.js` for the canonical shape. For
   **dashboard-aware** specs that need an authenticated in-browser session,
   first introduce `cy.loginAsTestUser(fixtureKey)` in
   `cypress/support/commands.js` (it doesn't exist yet — see the rule for the
   auth model the helper has to bridge). Drop the legacy login helpers
   (`cy.login`, `cy.performCleverOAuth`).
4. Remove the `.skip` from this spec's top-level `describe` /
   `context`, and from any nested `describe.skip` calls inside it.
5. If the spec covers a workflow no other coverage handles, document why
   in the PR description so reviewers can confirm the gap is intentional.

Component tests under `apps/dashboard/src/**/*.cy.js` are **not** affected.
They mount components in isolation and don't hit a backend.

## Why not just keep the stubs?

Stubbing `/me` and individual endpoints made sense when the backend was
out-of-process and inaccessible from CI. Now that the `e2e-tests` job
boots a real backend seeded from `baseFixture` (see
`apps/backend/src/test-support/`) alongside a Firebase Auth emulator,
stubs add friction without confidence — they let specs pass against a
fictitious response shape that the real backend might never produce.
