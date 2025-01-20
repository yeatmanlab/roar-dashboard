import translations from '../../../../src/translations/en/en-componentTranslations.json';

const PARTICIPANT_TESTLEGAL_USERNAME = Cypress.env('PARTICIPANT_TESTLEGAL_USERNAME');
const PARTICIPANT_TESTLEGAL_PASSWORD = Cypress.env('PARTICIPANT_TESTLEGAL_PASSWORD');

describe('Participant: Legal Docs', () => {
  it('Renders an assent form for un-assented users', () => {
    // Login as the participant with the test legal document.
    cy.login(PARTICIPANT_TESTLEGAL_USERNAME, PARTICIPANT_TESTLEGAL_PASSWORD);

    // Wait for the participant home page to load.
    cy.waitForParticipantHomepage();

    // Validate that the mock assent form is shown.
    // @TODO: Replace this with an actual legal document using cy.intercept once the legal document is available.
    cy.get('.p-dialog-title').contains(translations.consentModal.consentTitle).should('be.visible');
    cy.get('.p-dialog-footer').contains('Continue').should('be.visible');
    cy.get('button').contains('Continue').should('be.visible');
  });
});
