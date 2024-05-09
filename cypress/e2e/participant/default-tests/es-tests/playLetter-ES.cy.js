import { playLetter } from '../../../../support/helper-functions/roar-letter/letterHelpers';
const chokidar = require('chokidar');

// Specify the path to package.json
const packageJsonPath = 'package.json';

// Initialize chokidar watcher
const packageJsonWatcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
packageJsonWatcher.on('change', () => {
  console.log(`package.json has been updated`);
  testROARLetter();
});

// Example test function
function testROARLetter() {
  const administration = Cypress.env('testSpanishRoarAppsAdministration');
  const language = 'es';
  const gameCompleteText = '¡Has terminado! ¡Gracias por ayudarme a encontrar esas letras!';

  describe('ROAR - Letra Play Through', () => {
    it('Plays Letra', () => {
      playLetter(administration, language, gameCompleteText);
    });
  });
}
