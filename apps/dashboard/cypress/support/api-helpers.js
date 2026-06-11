/**
 * Shared helpers for backend-only smoke specs that talk to the seeded local
 * stack (Firebase Auth emulator + ROAR backend). See
 * `.ai/rules/frontend-e2e-testing-pattern.md`.
 */

const EMULATOR_HOST = Cypress.env('FIREBASE_AUTH_EMULATOR_HOST') ?? '127.0.0.1:9099';

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
 * @param {Object} [options] – Optional assertions on the sign-in response.
 * @param {string} [options.expectedAuthId] – When provided, asserts the
 *   emulator-issued UID (`localId`) matches this backend `authId`.
 * @returns {Cypress.Chainable<string>} Chainable resolving to the ID token.
 */
export function signInAs(user, { expectedAuthId } = {}) {
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
      if (expectedAuthId !== undefined) {
        expect(authRes.body.localId, 'emulator UID matches backend authId').to.eq(expectedAuthId);
      }
      return cy.wrap(authRes.body.idToken, { log: false });
    });
}
