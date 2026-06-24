import { startGame, playMultichoice } from "../../support/multichoiceHelpers";

const gameParams = "task=morphology";
const gameCompleteText = "You're all done!";

describe("Test play through of ROAR-Morphology as a participant", () => {
  it("ROAR-Morphology Play Through Test", () => {
    startGame(gameParams);
    playMultichoice(gameCompleteText);
  });
});
