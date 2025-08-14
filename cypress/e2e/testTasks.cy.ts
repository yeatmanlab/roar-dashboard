import 'cypress-real-events';

// Flag: when true, read URL and credentials from Cypress env; otherwise use defaults
const useEnvFlag: boolean = (() => {
  const v = Cypress.env('E2E_USE_ENV');
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
})();

const defaultUrl = 'https://localhost:5173/signin';

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.toString();
  } catch {
    return 'https://localhost:5173/signin';
  }
}
const defaultEmail = 'quqa2y1jss@levante.com';
const defaultPassword = 'xbqamkqc7z';

const dashboardUrl: string = useEnvFlag
  ? normalizeUrl(((Cypress.env('E2E_BASE_URL') as string) || defaultUrl))
  : defaultUrl;
const username: string = useEnvFlag
  ? ((Cypress.env('E2E_TEST_EMAIL') as string) || defaultEmail)
  : defaultEmail;
const password: string = useEnvFlag
  ? ((Cypress.env('E2E_TEST_PASSWORD') as string) || defaultPassword)
  : defaultPassword;

// starts each task and checks that it has loaded (the 'OK' button is present)
function startTask(tasksRemaining: number) {
  cy.get('[data-pc-section=tablist]', { timeout: 30000 })
    .children()
    .then((taskTabs) => {
      // start task
      cy.wrap(taskTabs.eq(tasksRemaining)).click();
      cy.scrollTo('bottomLeft', { ensureScrollable: false });
      cy.get('[data-pc-name=tabpanel][data-p-active=true]').children().contains('Click to start').click();

      // enter fullscreen and check that first instruction trial has loaded
      cy.contains('OK', { timeout: 600000 })
        .should('exist')
        .realClick()
        .then(() => {
          cy.contains('OK').should('exist');
        });

      // return to dashboard
      cy.go('back');
      cy.get('[data-pc-section=tablist]', { timeout: 240000 })
        .should('exist')
        .then(() => {
          if (tasksRemaining === 0) {
            return;
          } else {
            startTask(tasksRemaining - 1);
          }
        });
    });
}

describe('test core tasks from dashboard', () => {
  it('logs in to the dashboard and begins each task', () => {
    // Debug: log the credentials being used
    cy.log('Using URL: ' + dashboardUrl);
    cy.log('Using email: ' + username);
    cy.log('UseEnvFlag: ' + useEnvFlag);
    
    cy.visit(dashboardUrl);
    
    // Check for any JavaScript errors in the browser console
    cy.window().then((win) => {
      cy.log('Page loaded, checking for errors...');
    });
    
    // Wait for the page to load and check what's actually on the page
    cy.wait(5000);
    cy.get('body').then(($body) => {
      cy.log('Body content: ' + $body.text().substring(0, 200));
    });

    // input username
    cy.get('input')
      .should('have.length', 2)
      .then((inputs) => {
        cy.wrap(inputs[0]).clear().type(username);
        cy.log('Typed username: ' + username);
      });

    // input password
    cy.get('input')
      .should('have.length', 2)
      .then((inputs) => {
        cy.wrap(inputs[1]).clear().type(password);
        cy.log('Typed password length: ' + password.length);
      });

    // click go button
    cy.get('button').filter('[data-pc-name=button]').click();
    cy.log('Clicked login button');

    // wait a moment for login to process and check for errors
    cy.wait(3000);
    
    // Check if there are any error messages on the page
    cy.get('body').then(($body) => {
      if ($body.text().includes('error') || $body.text().includes('Error') || $body.text().includes('Invalid')) {
        cy.log('Error detected on page: ' + $body.text().substring(0, 500));
      }
    });
    
    // ensure we navigated away from /signin (fail fast if login didn't work)
    cy.location('pathname', { timeout: 30000 }).should((p) => expect(p).to.not.match(/\/signin$/));

    // check that each task loads
    cy.get('[data-pc-section=tablist]', { timeout: 240000 })
      .children()
      .then((children) => {
        const tasksToComplete: number = Array.from(children).length - 2;
        startTask(tasksToComplete);
      });

    cy.contains('sign out', { matchCase: false }).click();
  });
});
