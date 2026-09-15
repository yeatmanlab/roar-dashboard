import { startGame, playMultichoice } from '../../support/multichoiceHelpers';

const gameParams = 'task=cva&maxTime=1';
// 6 intro iterations plus 3 stimulus block iterations
const gameCompleteText = "You're all done!";

describe('Test play through of ROAR-Morphology as a participant', () => {
  it('ROAR-Morphology Play Through Test', () => {
    startGame(gameParams);
    playMultichoice(gameCompleteText);
  });
});
