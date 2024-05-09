import { optionalGames } from '../../../fixtures/optionalGamesList';
const chokidar = require('chokidar');

// Specify the path to package.json
const packageJsonPath = 'package.json';

// Initialize chokidar watcher
const packageJsonWatcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
packageJsonWatcher.on('change', () => {
  console.log(`package.json has been updated`);
  testOptionalGames();
});

// Example test function
function testOptionalGames() {
  const administration = Cypress.env('testOptionalRoarAppsAdministration');
  const language = 'en';

  function playOptionalGame(game, administration, language, optional) {
    game.testSpec(administration, language, optional);
  }

  describe('Play Optional Games', () => {
    optionalGames.forEach((game) => {
      it(`Plays ${game.name}`, () => {
        playOptionalGame(game, administration, language, true);
      });
    });
  });
}
