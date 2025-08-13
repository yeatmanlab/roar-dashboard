import 'cypress-real-events';

// Flag to use env-overrides
const useEnvFlag: boolean = (() => {
  const v = Cypress.env('E2E_USE_ENV');
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
})();


const baseUrl: string = useEnvFlag
  ? ((Cypress.env('E2E_BASE_URL') as string) || defaultUrl)
  : defaultUrl;
const username: string = useEnvFlag
  ? ((Cypress.env('E2E_TEST_EMAIL') as string) || defaultEmail)
  : defaultEmail;
const password: string = useEnvFlag
  ? ((Cypress.env('E2E_TEST_PASSWORD') as string) || defaultPassword)
  : defaultPassword;

const defaultLocales = ['en', 'en-US', 'es', 'es-CO', 'de', 'fr-CA', 'nl', 'en-GH', 'de-CH', 'es-AR'];
const localesEnv = (Cypress.env('E2E_LOCALES') as string) || '';
const locales = localesEnv
  ? localesEnv.split(',').map((s) => s.trim()).filter(Boolean)
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
      login();
      // assert route changes away from /signin within 30s
      cy.location('pathname', { timeout: 30000 }).should((p) => expect(p).to.not.match(/\/signin$/));
    });
  });
});
