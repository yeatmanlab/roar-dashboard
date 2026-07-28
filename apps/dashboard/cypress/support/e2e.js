// Import commands.js using ES2015 syntax:
import './commands';
import 'cypress-fs';

const firestoreUrl = Cypress.env('firestoreUrl');

Cypress.on('uncaught:exception', () => {
  return false;
});

beforeEach(() => {
  // Inject E2E test flag to handle conditional state in app code.
  // This is required as the window.Cypress object seems to be unreliable in some cases in the current Cypress version.
  cy.on('window:before:load', (win) => {
    win.localStorage.setItem('__E2E__', 'true');

    // Cypress does not print the application-under-test's browser console output to the terminal, so it never shows
    // up in CI logs (only in the interactive runner's console). Forward it through the existing cy.task('log', ...)
    // channel (see cypress.config.cjs) so it appears in CI output.
    ['log', 'warn', 'error'].forEach((level) => {
      const original = win.console[level];
      cy.stub(win.console, level).callsFake((...args) => {
        cy.task('log', `[browser console.${level}] ${args.map(String).join(' ')}`, { log: false });
        original.apply(win.console, args);
      });
    });
  });

  cy.visit('/');

  // Simulate different network conditions based on test file name.
  if (Cypress.spec.name.includes('4G')) {
    cy.task('log', 'Simulating 4G connection');
    cy.intercept(
      {
        method: 'GET',
        url: firestoreUrl,
        middleware: true,
      },
      (req) => {
        req.on('response', (res) => {
          res.setDelay(70); // average latency
          res.setThrottle(1250000); // average bandwidth
        });
      },
    ).as('4G Connection');
  } else if (Cypress.spec.name.includes('3G')) {
    cy.task('log', 'Simulating 3G connection');
    cy.intercept(
      {
        method: 'GET',
        url: firestoreUrl,
        middleware: true,
      },
      (req) => {
        req.on('response', (res) => {
          res.setDelay(150); // average latency
          res.setThrottle(750000); // average bandwidth
        });
      },
    ).as('3G Connection');
  } else if (Cypress.spec.name.includes('2G')) {
    cy.task('log', 'Simulating 2G connection');
    cy.intercept(
      {
        method: 'GET',
        url: firestoreUrl,
        middleware: true,
      },
      (req) => {
        req.on('response', (res) => {
          res.setDelay(650); // average latency
          res.setThrottle(20000); // average bandwidth
        });
      },
    ).as('2G Connection');
  } else if (Cypress.spec.name.includes('Offline')) {
    cy.task('log', 'Simulating offline condition');
    cy.intercept(
      {
        method: 'GET',
        url: firestoreUrl,
      },
      {
        forceNetworkError: true,
      },
    );
  } else if (Cypress.spec.name.includes('HighLatency')) {
    cy.task('log', 'Simulating high latency network');
    cy.intercept(
      {
        method: 'GET',
        url: firestoreUrl,
        middleware: true,
      },
      (req) => {
        req.on('response', (res) => {
          res.setDelay(800); // 800ms delay
        });
      },
    ).as('High Latency Network');
  } else if (Cypress.spec.name.includes('LowBandwidth')) {
    cy.task('log', 'Simulating low bandwidth network');
    cy.intercept(
      {
        method: 'GET',
        url: firestoreUrl,
        middleware: true,
      },
      (req) => {
        req.on('response', (res) => {
          res.setThrottle(10000); // 10 Kbps bandwidth
        });
      },
    ).as('Low Bandwidth Network');
  }
});
