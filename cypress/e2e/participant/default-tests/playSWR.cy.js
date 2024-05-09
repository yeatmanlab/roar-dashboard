import { playSWR } from '../../../support/helper-functions/roar-swr/swrHelpers.js';
const chokidar = require('chokidar');

// Specify the path to package.json
const packageJsonPath = 'package.json';

// Initialize chokidar watcher
const packageJsonWatcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
packageJsonWatcher.on('change', () => {
  console.log(`package.json has been updated`);
  testROARWord();
});

// Example test function
function testROARWord() {
  const administration = Cypress.env('testRoarAppsAdministration');
  const language = 'en';

  describe('ROAR - Word Play Through', () => {
    it('Plays Word', () => {
      playSWR(administration, language);
    });
  });
}
