import { startGame, playMultichoice } from "../../support/multichoiceHelpers";

const gameParams = "task=cva";
const gameCompleteText = "You're all done!";

describe("Test playthrough of ROAR-Written Vocabulary as a participant", () => {
  it("ROAR-Written Vocabulary  Play Through Test", () => {
    startGame(gameParams);
    playMultichoice(gameCompleteText);
  });
});
