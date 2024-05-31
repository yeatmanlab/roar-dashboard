import { testSpecs } from '../../fixtures/taskTestSpecs';
import { generatedSpecTemplate } from '../../fixtures/generatedTestTemplate';
import { getDevFirebase } from '../../support/devFirebase';
import { getOpenAdministrations } from '../../support/query';
import fs from 'fs';

const timeout = Cypress.env('timeout');

async function getOpenAdmins() {
  const adminFirestore = getDevFirebase('admin').db;
  const openAdmins = await getOpenAdministrations(adminFirestore);

  return openAdmins.filter((admin) => admin.includes('Synced Administration'));
}

function createAdminTestSpec(adminName) {
  cy.log(fs);
  fs.writeFileSync(`generated-tests/${adminName}.cy.js`, generatedSpecTemplate(adminName));
}

describe('Generating administration spec files', () => {
  let openAdmins;

  beforeEach(() => {
    // Log in as a super admin and fetch all open administrations from Firestore
    cy.then(async () => {
      openAdmins = await getOpenAdmins();
      cy.wrap(openAdmins).as('openAdmins');
      cy.log('Found', openAdmins.length, 'open administrations.');
    });
  });

  it('Logs the open administrations', () => {
    cy.get('@openAdmins').then((openAdmins) => {
      cy.log('Found', openAdmins.length, 'open administrations.');
      openAdmins.forEach((admin) => {
        cy.log(`Found administration: ${admin}`);
      });
    });
  });

  it('Creates a test spec for each open administration', () => {
    // Clear all saved sessions and log in as a participant
    Cypress.session.clearAllSavedSessions();
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });

    cy.get('@openAdmins').then((openAdmins) => {
      openAdmins.forEach((admin) => {
        // Creating a test spec file for the current administration
        cy.log(admin);
        // createAdminTestSpec(admin);
      });
    });
    cy.log('Successfully tested all games for all open administrations!');
  });
});
