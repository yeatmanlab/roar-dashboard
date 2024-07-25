import { playMorphology } from '../../../support/helper-functions/roar-multichoice/multichoiceHelpers';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roar-multichoice';

describe('ROAR - Written Vocabulary Play Through', () => {
  it('Plays Written Vocabulary with username/password auth', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playMorphology({ auth: 'username' });
      }
    });
  });
  it('Plays Written Vocabulary with Clever auth', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playMorphology({ auth: 'clever' });
      }
    });
  });
});
