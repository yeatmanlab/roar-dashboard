// const timeout = Cypress.env('timeout');
//
// describe('Testing playthrough of SWR as a participant', () => {
//
//   beforeEach(() => {
//     cy.intercept('*', (req) => {
//       req.continue((res) => {
//         res.send({
//           delayMs: 500,
//           });
//         });
//       });
//   });
//
//   it('Simulates a ROAR-Word Playthrough on a low bandwidth network', () => {
//     cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
//     cy.visit('/', {timeout: timeout});
//     cy.get('.p-dropdown-trigger', { timeout: 10 * timeout })
//       .should('be.visible')
//       .click();
//     cy.get('.p-dropdown-item', { timeout: 10 * timeout })
//       .contains(Cypress.env('testRoarAppsAdministration'))
//       .should('be.visible')
//       .click();
//
//     cy.get('.p-tabview').contains('ROAR-Word');
//     cy.visit(`/game/swr`);
//
//     cy.get('.jspsych-btn', { timeout: 60 * timeout })
//       .should('be.visible')
//       .click();
//
//     // handles error where full screen throws a permissions error
//     cy.wait(0.1 * timeout);
//     Cypress.on('uncaught:exception', () => {
//       return false;
//     });
//     playSWRGame();
//   });
// });
//
// function playSWRGame() {
//   // play tutorial
//   cy.contains('Welcome to the world of Lexicality!', { timeout: timeout });
//   for (let i = 0; i < 3; i++) {
//     cy.get('body', { timeout: timeout }).type('{leftarrow}');
//   }
//   cy.get('.jspsych-btn', { timeout: 10 * timeout })
//     .should('be.visible')
//     .click();
//   Cypress.on('uncaught:exception', () => {
//     return false;
//   });
//
//   // intro
//   playIntro();
//
//   playSWRBlock('You are halfway through the first block');
//   playSWRBlock('You have completed the first block');
//   playSWRBlock('You are halfway through the second block');
//   playSWRBlock('You have completed the second block');
//   playSWRBlock('You are halfway through the third block');
//   finishSWR('You say farewell to your new friends and leave the land of Lexicality. Until next time!');
//
//   // check if game completed
//   cy.get('.p-dropdown-trigger', { timeout: 50 * timeout })
//     .should('be.visible')
//     .click();
//   cy.get('.p-dropdown-item', { timeout: 10 * timeout })
//     .contains(Cypress.env('testRoarAppsAdministration'))
//     .should('be.visible')
//     .click();
//   cy.get('.tabview-nav-link-label').contains('ROAR-Word').should('have.attr', 'data-game-status', 'complete');
// }
//
// function playIntro() {
//   for (let i = 0; i <= 5; i++) {
//     cy.log(i);
//     cy.wait(0.2 * timeout);
//     cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 5 * timeout });
//     cy.wait(0.2 * timeout);
//     cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 2 * timeout });
//     cy.wait(0.2 * timeout);
//   }
//   cy.get('.jspsych-btn', { timeout: 5 * timeout })
//     .contains('Continue')
//     .click();
//   Cypress.on('uncaught:exception', () => {
//     return false;
//   });
// }
//
// function playSWRBlock(block_termination_phrase) {
//   cy.wait(0.3 * timeout);
//   cy.get('body', { timeout: 5 * timeout }).then((body) => {
//     cy.log('entering stage: ', block_termination_phrase);
//     if (!body.find('.stimulus').length > 0) {
//       cy.get('body', { timeout: timeout }).type('{leftarrow}');
//       cy.get('.jspsych-btn', { timeout: 5 * timeout })
//         .contains('Continue')
//         .click();
//       Cypress.on('uncaught:exception', () => {
//         return false;
//       });
//     } else {
//       cy.get('body', { timeout: timeout }).type('{rightarrow}');
//       cy.get('body', { timeout: timeout }).type('{leftarrow}');
//       playSWRBlock(block_termination_phrase);
//     }
//   });
// }
//
// function finishSWR(block_termination_phrase) {
//   cy.wait(0.3 * timeout);
//   cy.get('body', { timeout: 5 * timeout }).then((body) => {
//     if (!body.find('.stimulus').length > 0) {
//       assert(cy.contains(block_termination_phrase));
//       cy.wait(0.2 * timeout);
//       cy.get('body', { timeout: 5 * timeout }).type('{leftarrow}');
//     } else {
//       // cy.get(".stimulus").should("be.visible");
//       cy.wait(0.2 * timeout);
//       cy.get('body', { timeout: 5 * timeout }).type('{rightarrow}');
//       finishSWR(block_termination_phrase);
//     }
//   });
// }
