const startText = ' Are you ready to play some games with me and my friends?';

const endBlockText = {
  endText1: 'Take a break if needed',
  endText2: 'I have been swimming so much',
  endText3: 'You have helped me and all my friends!',
};
const breakBlockText = 'Take a break if needed';
const breakBlockText2 = {
  break1: 'Great job',
  break2: 'Look at all those carrots',
  break3: 'You are doing great',
};
describe('Test play through of PA as a participant', () => {
  it('ROAR-PA through Test', () => {
    cy.playPA(startText, breakBlockText, breakBlockText2, endBlockText);
  });
});
