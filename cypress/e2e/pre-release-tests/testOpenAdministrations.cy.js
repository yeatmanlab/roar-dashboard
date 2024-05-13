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
import { getOpenAdministrations } from '../../support/query';
import { getDevFirebase } from '../../support/devFirebase';

const timeout = Cypress.env('timeout');
const testSpecs = [
  {
    name: 'ROAR - Picture Vocabulary',
    spec: playVocabulary,
    language: 'en',
  },
  {
    name: 'ROAR - Written Vocabulary',
    spec: playWrittenVocabulary,
    language: 'en',
  },
  {
    name: 'ROAR - Letter',
    spec: playLetter,
    language: 'en',
  },
  {
    name: 'ROAR - Letra',
    spec: playLetter,
    language: 'es',
  },
  {
    name: 'ROAR - Morphology',
    spec: playMorphology,
    language: 'en',
  },
  {
    name: 'ROAR - Phoneme',
    spec: playPA,
    language: 'en',
  },
  {
    name: 'ROAR - Fonema',
    spec: playPA,
    language: 'es',
  },
  {
    name: 'ROAR - Sentence',
    spec: playSRE,
    language: 'en',
  },
  {
    name: 'ROAR - Frase',
    spec: playSRE,
    language: 'es',
  },
  {
    name: 'ROAR - Word',
    spec: playSWR,
    language: 'en',
  },
  {
    name: 'ROAR - Palabra',
    spec: playSWR,
    language: 'es',
  },
  {
    name: 'ROAM - Single Digit',
    spec: playFluencyARF,
    language: 'en',
  },
  {
    name: 'ROAM - Un Dígito',
    spec: playFluencyARF,
    language: 'es',
  },
  {
    name: 'ROAM - Multi Digit',
    spec: playFluencyCALF,
    language: 'en',
  },
  {
    name: 'ROAM - Varios Dígitos',
    spec: playFluencyCALF,
    language: 'es',
  },
];

async function getOpenAdmins() {
  const adminFirestore = getDevFirebase('admin').db;
  const openAdmins = await getOpenAdministrations(adminFirestore);

  return openAdmins.filter((admin) => admin.includes('Synced Administration'));
}

function checkOptionalGame(spec, admin, text) {
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="switch-show-optional-assessments"]').length > 0) {
      cy.switchToOptionalAssessments();
      if (text.includes(spec.name)) {
        cy.log(`Initializing test for optional game: ${spec.name}`);

        spec.spec({
          administration: admin,
          language: spec.language,
        });
      } else {
        cy.log('No optional game found for game:', spec.name);
      }
    } else {
      cy.log('No game found for game:', spec.name);
    }
  });
}

function testGame(spec, admin) {
  cy.wait(0.1 * timeout);
  cy.get('.p-tabview')
    .invoke('text')
    .then((text) => {
      if (text.includes(spec.name)) {
        cy.log(`Initializing test for game: ${spec.name}`);

        spec.spec({
          administration: admin,
          language: spec.language,
        });
      } else {
        checkOptionalGame(spec, admin, text);
      }
    });
}

describe('Testing all open administrations', () => {
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

  it('Tests the open administrations', () => {
    // Clear all saved sessions and log in as a participant
    Cypress.session.clearAllSavedSessions();
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });

    cy.get('@openAdmins').then((openAdmins) => {
      openAdmins.forEach((admin) => {
        cy.log(`Testing ${admin}`);
        cy.selectAdministration(admin);
        testSpecs.forEach((spec) => {
          testGame(spec, admin);
        });
        cy.log('Successfully tested all games for administration: ', admin);
      });
    });
    cy.log('Successfully tested all games for all open administrations!');
  });
});
