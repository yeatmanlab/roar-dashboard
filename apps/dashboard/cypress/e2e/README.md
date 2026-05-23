# Cypress E2E specs — pending migration

As of #1774, every spec in this directory is marked `describe.skip` (or
`context.skip`). They were written against:

- Real dev Firebase Auth + Firestore for authentication and data
- The previous Cloud Functions / `roarfirekit` / Firestore REST data layer
- A default `/me` `cy.intercept` stub in `cypress/support/e2e.js` so the
  dashboard's `useMeQuery` would resolve in the absence of a reachable
  backend

The dashboard is being migrated to the new ts-rest backend. Each frontend
migration PR is expected to bring the relevant specs back online against
the seeded local backend (`apps/backend/src/server-test.ts`) and the
Firebase Auth emulator — not by un-skipping the existing spec verbatim,
but by re-thinking what the test should cover under the new architecture.

## How to bring a spec back online

1. Read `.ai/rules/frontend-e2e-testing-pattern.md` for the contract:
   what to authenticate with, which seeded fixture users are available,
   how to talk to the local backend, and the difference between component
   tests (kept as-is) and e2e tests (re-written per migration).
2. Decide whether the spec is still the right level of coverage. Many of
   the legacy specs are better expressed as component tests now that the
   container/presentational split is wider — don't reach for an e2e spec
   if a component test would do.
3. Replace the spec's body with the new pattern: `cy.loginAsTestUser(...)`
   → `cy.visit(...)` → assertions against real `/me` and resource
   responses. Drop the legacy login helpers (`cy.login`, `cy.performCleverOAuth`).
4. Remove the `.skip` from this spec's top-level `describe` /
   `context`, and from any nested `describe.skip` calls inside it.
5. If the spec covers a workflow no migration ticket covers, document why
   in the PR description so reviewers can confirm the gap is intentional.

Component tests under `apps/dashboard/src/**/*.cy.js` are **not** affected
by this cutover. They mount components in isolation and don't hit a
backend.

## Why not just keep the stubs?

Stubbing `/me` and individual endpoints worked while the backend was
out-of-process and inaccessible from CI. Now that we boot a real backend
seeded from `baseFixture` (see `apps/backend/src/test-support/`) and a
Firebase Auth emulator alongside it, stubs add friction without confidence —
they let specs pass against a fictitious response shape that the real
backend might never produce.
