import { playFluencyARF } from '../../../../support/helper-functions/roam-fluency/fluencyHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roam-fluency';

describe('Test playthrough of Fluency as a participant in a simulated 3G network', () => {
  it('Fluency Playthrough Test', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playFluencyARF();
      }
    });
  });
});
