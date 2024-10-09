import { playSRE } from '../../support/helper-functions/roar-sre/sreHelpers.js';
import { playSWR } from '../../support/helper-functions/roar-swr/swrHelpers.js';

// Current zzzCypressTestOptionalRoarApps contains the following optional games
// To add more optional games, recreate the administration with the desired games,
// assign to zzzCypressTestDistrict, and then add the game(s) to the list below
// The game name must match the name of the game in the administration
// The testSpec must match the name of the testSpec in the file

export const optionalGames = [
  {
    name: 'ROAR - Sentence',
    testSpec: playSRE,
    app: '@bdelab/roar-sre',
  },
  {
    name: 'ROAR - Word',
    testSpec: playSWR,
    app: '@bdelab/roar-swr',
  },
];
