// Import commands.js using ES2015 syntax:
import './commands';
import 'cypress-fs';

const firestoreUrl = Cypress.env('firestoreUrl');

Cypress.on('uncaught:exception', () => {
  return false;
});

// beforeEach hook to simulate various network conditions based on information in the test filename.
beforeEach(() => {
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
          res.setDelay(2000); // 2 seconds delay
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
