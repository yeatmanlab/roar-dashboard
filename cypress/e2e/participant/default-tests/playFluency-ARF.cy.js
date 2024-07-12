import { playFluencyARF } from '../../../support/helper-functions/roam-fluency/fluencyHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roam-fluency';

describe('Test playthrough of Fluency as a participant', () => {
  it('Fluency Playthrough Test with username/password authentication', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playFluencyARF({ auth: 'username' });
      }
    });
  });
  it('Fluency Playthrough Test with Clever authentication', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playFluencyARF({ auth: 'clever' });
      }
    });
  });
});
