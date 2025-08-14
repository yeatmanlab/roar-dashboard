import 'cypress-real-events';

// Flag to use env-overrides
const useEnvFlag: boolean = (() => {
  const v = Cypress.env('E2E_USE_ENV');
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
})();

// Defaults for emulator runs (HTTP)
const defaultUrl = 'http://localhost:5173/signin';
const defaultEmail = 'student@levante.test';
const defaultPassword = 'student123';

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
  typeInto('input:eq(0)', username);
  typeInto('input:eq(1)', password, { log: false });
  cy.get('button').filter('[data-pc-name=button]').first().click();
}

locales.forEach((locale) => {
  describe(`emulator login: ${locale}`, () => {
    it(`logs in successfully for ${locale}`, () => {
      cy.visit(baseUrl, setLocaleBeforeLoad(locale));
      cy.get('input').should('have.length.at.least', 2);
      login();
      cy.location('pathname', { timeout: 30000 }).should((p) => expect(p).to.not.match(/\/signin$/));
    });
  });
});


