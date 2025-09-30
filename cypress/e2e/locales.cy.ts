import 'cypress-real-events';

// Ignore Firebase auth network errors when skipping login
// Keeps locale render checks green without emulator/backend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @ts-ignore
// Cypress is available globally in spec files
// We conditionally attach after skipLoginFlag is computed below

// Flag to use env-overrides
const useEnvFlag: boolean = (() => {
  const v = Cypress.env('E2E_USE_ENV');
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
})();

// Defaults for local dev/emulator runs
const defaultUrl = 'http://localhost:5173/signin';
const defaultEmail = 'student@levante.test';
const defaultPassword = 'student123';

// Optionally skip login step (useful when emulator/backend is not available)
const skipLoginFlag: boolean = (() => {
  const v = Cypress.env('E2E_SKIP_LOGIN');
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
})();

if (skipLoginFlag) {
  Cypress.on('uncaught:exception', (err) => {
    if (/auth\/network-request-failed/i.test(err.message)) return false;
    return true;
  });
}

const baseUrl: string = useEnvFlag ? (Cypress.env('E2E_BASE_URL') as string) || defaultUrl : defaultUrl;
const username: string = useEnvFlag ? (Cypress.env('E2E_TEST_EMAIL') as string) || defaultEmail : defaultEmail;
const password: string = useEnvFlag ? (Cypress.env('E2E_TEST_PASSWORD') as string) || defaultPassword : defaultPassword;

const defaultLocales = ['en', 'en-US', 'es', 'es-CO', 'de', 'fr-CA', 'nl', 'en-GH', 'de-CH', 'es-AR'];
const localesEnv = (Cypress.env('E2E_LOCALES') as string) || '';
const locales = localesEnv
  ? localesEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : defaultLocales;

function setLocaleBeforeLoad(locale: string) {
  return {
    onBeforeLoad(win: Window) {
      // App checks one of these keys based on brand
      win.sessionStorage.setItem('levantePlatformLocale', locale);
      win.sessionStorage.setItem('roarPlatformLocale', locale);
    },
  };
}

function typeInto(selector: string, value: string, opts: Partial<Cypress.TypeOptions> = {}) {
  cy.get(selector)
    .should('be.visible')
    .click()
    .type('{selectall}{backspace}', { delay: 0 })
    .type(value, { delay: 0, ...opts });
}

function login() {
  // input username/password with re-queries to avoid detached elements
  typeInto('input:eq(0)', username);
  typeInto('input:eq(1)', password, { log: false });

  // click go button
  cy.get('button').filter('[data-pc-name=button]').first().click();
}

locales.forEach((locale) => {
  describe(`locale smoke: ${locale}`, () => {
    it(`renders signin and navigates after login for ${locale}`, () => {
      cy.visit(baseUrl, setLocaleBeforeLoad(locale));
      // ensure signin page shows inputs
      cy.get('input').should('have.length.at.least', 2);
      if (skipLoginFlag) {
        // Only verify sign-in page renders for this locale (no auth calls)
        cy.contains(/sign in|sign-in|login/i).should('exist');
        return;
      }
      login();
      // assert route changes away from /signin within 30s
      cy.location('pathname', { timeout: 30000 }).should((p) => expect(p).to.not.match(/\/signin$/));
    });
  });
});
