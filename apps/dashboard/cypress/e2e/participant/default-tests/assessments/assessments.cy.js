// SKIPPED until #1827: assessment play-through tests need reevaluation after monorepo migration
describe.skip('Participant Assessments', () => {
  it('Renders assessment videos', () => {
    cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));

    cy.waitForParticipantHomepage();

    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));

    cy.findByTestId('game-tablist').contains('ROAR - Word').click();

    // @TODO: Extend tests to actually test that the video is playing.
    cy.get('.video-player-wrapper').click();
  });
});
