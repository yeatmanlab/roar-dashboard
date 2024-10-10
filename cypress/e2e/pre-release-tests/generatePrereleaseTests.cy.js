import { generatedSpecTemplate } from '../../fixtures/super-admin/generatedTestTemplate.js';
import { getDevFirebase } from '../../support/devFirebase';
import { getOpenAdministrations } from '../../support/query';

const timeout = Cypress.env('timeout');
const testDirName = 'cypress/e2e/pre-release-tests/generated-tests';
async function getOpenAdmins() {
  const adminFirestore = getDevFirebase('admin').db;
  const openAdmins = await getOpenAdministrations(adminFirestore);

  return openAdmins.filter((admin) => admin.includes('Synced Administration'));
}

function createAdminTestSpec(adminName) {
  cy.log('Creating test spec for administration:', adminName);
  cy.writeFile(`${testDirName}/${adminName.replaceAll(' ', '_')}.cy.js`, generatedSpecTemplate(adminName)).then(() => {
    cy.log('Successfully created test spec:', adminName);
  });
}

describe('Fetches all open administrations and generates test spec files for each one.', () => {
  let openAdmins;

  beforeEach(() => {
    // Log in as a super admin and fetch all open administrations from Firestore
    cy.then(async () => {
      openAdmins = await getOpenAdmins();
      cy.wrap(openAdmins).as('openAdmins');
      cy.log('Found', openAdmins.length, 'open administrations.');
    });
  });

  it('Logs the open administrations.', () => {
    cy.get('@openAdmins').then((openAdmins) => {
      cy.log('Found', openAdmins.length, 'open administrations.');
      openAdmins.forEach((admin) => {
        cy.log(`Found administration: ${admin}`);
      });
    });
  });

  it('Deletes existing test spec files if they exist.', () => {
    cy.log('Checking for existing test spec files...');
    cy.fsDirExists(`./${testDirName}`).then((directoryExists) => {
      if (directoryExists === true) {
        cy.log('Deleting existing test spec directory...');
        cy.fsDeleteDirectory(`./${testDirName}`, { recursive: true }).then(() => {
          cy.fsCreateDirectory(`./${testDirName}`).then(() => {
            cy.log(`Created test spec directory: ${testDirName}`);
          });
        });
      } else {
        cy.log('Creating new test spec directory...');
        cy.fsCreateDirectory(`./${testDirName}`).then(() => {
          cy.log(`Created test spec directory: ${testDirName}`);
        });
      }
    });
  });

  it('Creates a test spec for each open administration.', () => {
    cy.log('Clearing all saved sessions...');
    Cypress.session.clearAllSavedSessions();
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });

    cy.log('Getting open admins...');
    cy.get('@openAdmins').then((openAdmins) => {
      openAdmins.forEach((admin) => {
        // Creating a test spec file for the current administration
        cy.fsDirExists(`./${testDirName}`).then((directoryExists) => {
          if (!directoryExists) {
            // throw new Error('Test spec directory does not exist.');
            cy.log('No directory found, creating a new one...');
            cy.fsCreateDirectory(`./${testDirName}`).then(() => {
              cy.log(`Created test spec directory: /generated-tests`);
            });
          }
          try {
            createAdminTestSpec(admin);
          } catch (error) {
            cy.log('Error creating test spec:', error);
          }
        });
      });
    });
    cy.log('Successfully generated test spec files for all open administrations.');
  });
});
