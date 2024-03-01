const timeout = Cypress.env('timeout');
const participantId = '123456789';
const practiceNumber = '1';
const questionInput = '42';

function typeEnter() {
  cy.get('body').type('{enter}');
}

function waitTimeout() {
  cy.wait(0.1 * timeout);
}

function playFluencyIntro() {
  waitTimeout();

  //   Click textbox and enter random participantId
  cy.get('#input-0', {timeout: timeout}).type(`${participantId} {enter}`,)
  typeEnter()

  //   Input any number
  cy.get('#practice_number', {timeout: timeout}).type(practiceNumber)

  //   Click enter
  typeEnter()
  waitTimeout();

  // Click enter
  typeEnter()
  waitTimeout();

  //   Click backspace
  cy.get('body').type('{backspace}')
  waitTimeout();

  //   Enter x2
  cy.get('body').type('x2 {enter}')
  waitTimeout();

  //   Type 4, enter x2
  cy.get('#question_input_key').type('4')
  waitTimeout();
  cy.get('#question_input_key').type('{enter}')
  typeEnter()
  waitTimeout();
  typeEnter()

  //   Type 2, enter x2
  cy.get('#question_input_key').type('2')
  waitTimeout();
  cy.get('#question_input_key').type('{enter}')
  typeEnter()
  waitTimeout();
  typeEnter()

  // Proceed to main game loop
  typeEnter()
  typeEnter()
}

function playFluencyLoop() {
  cy.get('#question_input_key').type(questionInput)
  waitTimeout();
  cy.get('#question_input_key').type('{enter}')
  waitTimeout();
}

function checkGameComplete(endText) {
   cy.get('body').invoke('text').then( (text) => {
     if (text.includes(endText)) {
       cy.get('body').should('contain', endText).then(() => {cy.get('body').type('{enter}')})
       cy.log('Game complete.')
     }
     else {
       cy.log("Continuing game...")
       playFluencyLoop()
       checkGameComplete(endText)
     }
   })
}

export function playFluency(endText) {
  playFluencyIntro();
  checkGameComplete(endText);
}