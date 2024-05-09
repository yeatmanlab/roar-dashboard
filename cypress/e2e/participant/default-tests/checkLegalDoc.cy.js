const chokidar = require('chokidar');
const fs = require('fs');

// Specify the path to package.json
const packageJsonPath = '../../../../package.json';

// Initialize chokidar watcher
const watcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
watcher.on('change', (path) => {
  // Check if the changed file is package.json
  if (path === packageJsonPath) {
    console.log(`package.json has been updated`);
    testAssentForm();
  }
});

// Example test function
function testAssentForm() {
  describe('Test to maintain that assent form shows when signing in with an un-assented user', () => {
    it('passes', () => {
      // your test logic here
      let test_login = 'DO_NOT_ACCEPT_DOC';
      let test_pw = 'passwordLEGAL';
      cy.login(test_login, test_pw);
      cy.visit('/');
      cy.wait(1000);
      cy.get('.p-dialog-title').contains('Assent Form').should('be.visible');
      cy.get('.p-confirm-dialog-accept').contains('Continue').should('be.visible');
    });
  });
}
