import { playFluencyCALF } from '../../../support/helper-functions/roam-fluency/fluencyHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roam-fluency';

describe('Test playthrough of Fluency as a participant using username authentication', () => {
  it('Fluency Playthrough Test', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playFluencyCALF({ auth: 'username' });
      }
    });
  });
  it('Fluency Playthrough Test using Clever authentication', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playFluencyCALF({ auth: 'clever' });
      }
    });
  });
});
