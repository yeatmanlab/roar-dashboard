import { playARF } from '../../../../support/helper-functions/roam-apps/roamHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roam-apps';
describe('Test playthrough of ROAM as a participant in a simulated high latency networkt', () => {
  it('ROAM Playthrough Test', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playARF();
      }
    });
  });
});
