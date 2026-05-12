const endBlockText = 'You have completed the last block';
const breakBlockText = 'You are halfway through';
const breakBlockText2 = 'This experiment is loading';
describe('Test play through of PA as a participant', () => {
  it('ROAR-PA StoryOption through Test', () => {
    cy.playPASO(breakBlockText, breakBlockText2, endBlockText);
  });
});
