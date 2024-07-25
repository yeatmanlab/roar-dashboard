import { generatedSpecTemplate } from '../../fixtures/generatedTestTemplate';
import { getDevFirebase } from '../../support/devFirebase';
import { getOpenAdministrations } from '../../support/query';
import * as path from 'path';

const timeout = Cypress.env('timeout');

async function getOpenAdmins() {
  const adminFirestore = getDevFirebase('admin').db;
  const openAdmins = await getOpenAdministrations(adminFirestore);

  return openAdmins.filter((admin) => admin.includes('Synced Administration'));
}

function createAdminTestSpec(adminName) {
  cy.log('Creating test spec for administration:', adminName);
  const currentPath = __dirname;
  const testSpecPath = path.join(currentPath, 'generated-tests', `${adminName.replaceAll(' ', '_')}.cy.js`);
  cy.log(`Test spec path: ${testSpecPath}`);
  cy.fsWriteFile(testSpecPath, generatedSpecTemplate(adminName));
  cy.log('Successfully created test spec:', adminName);
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

    cy.log('Getting open admins...');
    cy.get('@openAdmins').then((openAdmins) => {
      cy.log('Inside get open admins...');
      const currentPath = __dirname;
      cy.log(`Current path: ${currentPath}`);
      const dirPath = path.join(currentPath, 'generated-tests');

      cy.log(`Current working directory: ${dirPath}`);
      cy.log('Checking for existing test spec files...');

      if (cy.fsDirExists(dirPath)) {
        // Delete when running locally; use step in GitHub Actions when running in CI
        cy.log('Deleting existing test spec directory...');
        cy.fsDeleteDirectory(dirPath, { recursive: true });
      }

      try {
        cy.log('Creating test spec directory...');
        cy.fsCreateDirectory(dirPath);
      } catch (error) {
        cy.log(`Error creating test spec directory: ${error}`);
      }
      openAdmins.forEach((admin) => {
        // Creating a test spec file for the current administration
        createAdminTestSpec(admin);
      });
    });
    cy.log('Successfully generated test spec files for all open administrations.');
  });
});
