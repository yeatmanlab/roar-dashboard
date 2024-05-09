const chokidar = require('chokidar');

// Specify the path to package.json
const packageJsonPath = 'package.json';

// Initialize chokidar watcher
const packageJsonWatcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
packageJsonWatcher.on('change', () => {
  console.log(`package.json has been updated`);
  testPlayVideo();
});

// Example test function
function testPlayVideo() {
  const timeout = Cypress.env('timeout');

  describe('Playing Video', () => {
    it('plays-video', () => {
      cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
      cy.visit('/', { timeout: 2 * timeout });
      cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
      cy.get('.tabview-nav-link-label', { timeout: 2 * timeout })
        .contains('ROAR - Word')
        .click();
      cy.get('.vjs-big-play-button', { timeout: 2 * timeout }).click();
    });
  });
}
