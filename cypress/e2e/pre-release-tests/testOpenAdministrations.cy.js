import { playSWR } from '../../support/helper-functions/roar-swr/swrHelpers';
import { playSRE } from '../../support/helper-functions/roar-sre/sreHelpers';
import { playLetter } from '../../support/helper-functions/roar-letter/letterHelpers';
import { playPA } from '../../support/helper-functions/roar-pa/paHelpers';
import { playFluencyARF, playFluencyCALF } from '../../support/helper-functions/roam-fluency/fluencyHelpers';
import {
  playMorphology,
  playWrittenVocabulary,
} from '../../support/helper-functions/roar-multichoice/multichoiceHelpers';
import { playVocabulary } from '../../support/helper-functions/roar-vocab/vocabHelpers';

// Create helper functions for every game which can be called here to play the game
// These helper functions must take an object for its parameters, with explicit default values
// Each helper function must be a complete test that logs in, plays the game, and checks for game completion

const timeout = Cypress.env('timeout');
const testSpecs = [
  {
    name: 'ROAR - Picture Vocabulary',
    spec: playVocabulary,
  },
  {
    name: 'ROAR - Written Vocabulary',
    spec: playWrittenVocabulary,
  },
  {
    name: 'ROAR - Letter',
    spec: playLetter,
  },
  {
    name: 'ROAR - Morphology',
    spec: playMorphology,
  },
  {
    name: 'ROAR - Phoneme',
    spec: playPA,
  },
  {
    name: 'ROAR - Sentence',
    spec: playSRE,
  },
  {
    name: 'ROAR - Word',
    spec: playSWR,
  },
  {
    name: 'ROAM - Single Digit',
    spec: playFluencyARF,
  },
  {
    name: 'ROAM - Multi Digit',
    spec: playFluencyCALF,
  },
];

function retryTest(testFunc, retries = 3) {
  let attempts = 0;
  const run = () => {
    attempts++;
    try {
      testFunc();
    } catch (error) {
      if (attempts < retries) {
        cy.log(`Test failed, retrying... (${attempts}/${retries})`);
        run();
      } else {
        throw error;
      }
    }
  };
  run();
}

async function getOpenAdmins() {
  cy.get('[data-cy=dropdown-select-administration]').click();
  cy.get('.p-dropdown-panel').within(() => {
    cy.get('li').each((el) => {
      if (el.text().includes('Synced Administration')) {
        openAdmins.push(el.text());
      }
    });
  });
  cy.get('[data-cy=dropdown-select-administration]').click();
}

const openAdmins = [];

describe('Testing all open administrations', () => {
  it('Tests the open administration', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });

    getOpenAdmins();
    cy.log('Found', openAdmins.length, 'open administrations.');

    cy.then(() => {
      openAdmins.forEach((admin) => {
        cy.log(`Testing ${admin}`);
        cy.selectAdministration(admin);

        testSpecs.forEach((spec) => {
          cy.get('.p-tabview')
            .invoke('text')
            .then((text) => {
              if (text.includes(spec.name)) {
                cy.log(`Initializing test for ${spec.name}`);

                retryTest(() => {
                  spec.spec({
                    administration: admin,
                  });
                });
              } else {
                cy.log('No game found for', spec.name);
              }
            });
        });
        cy.log('Successfully tested all games for administration: ', admin);
      });
    });
    cy.log('Successfully tested all games for all open administrations!');
  });
});
