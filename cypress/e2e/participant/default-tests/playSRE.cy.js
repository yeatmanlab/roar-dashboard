import { playSRE } from '../../../support/helper-functions/roar-sre/sreHelpers';
const chokidar = require('chokidar');

// Specify the path to package.json
const packageJsonPath = 'ackage.json';

// Initialize chokidar watcher
const packageJsonWatcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
packageJsonWatcher.on('change', () => {
  console.log(`package.json has been updated`);
  testROARSentence();
});

function testROARSentence() {
  const administration = Cypress.env('testRoarAppsAdministration');
  const language = 'en';

  describe('ROAR - Sentence Play Through', () => {
    it('Plays SRE', () => {
      playSRE(administration, language);
    });
  });
}
