import { playCALF } from '../../../support/helper-functions/roam-apps/roamHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roam-apps';

describe('Test playthrough of ROAM CALF-ES as a participant using username authentication', () => {
  it('ROAM Playthrough Test', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playCALF({ auth: 'username' });
      }
    });
  });
  it('ROAM Playthrough Test using Clever authentication', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playCALF({ auth: 'clever' });
      }
    });
  });
});
