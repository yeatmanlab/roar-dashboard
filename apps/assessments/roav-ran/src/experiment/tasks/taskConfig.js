import RANTask from "./RAN/task.js";
import { initConfig as initConfigRAN } from "./RAN/helpers/initConfigRAN.js";
import assetsRAN from "./RAN/audioTextInfoRAN.json";
import symbolSearchTask from "./symbolSearch/task.js";
import { initConfig as initConfigSymbol} from "./symbolSearch/helpers/initConfigSymbol.js";
import assetsSymbol from "./symbolSearch/audioTextInfoSymbol.json"
import { imageAssetsSymbol } from "./symbolSearch/imageAssets.js"

export default {
  ran: {
    initConfig: initConfigRAN,
    buildTaskViews: RANTask,
    audioMapping: assetsRAN,
    imageAssets: [],
  },
  symbolSearch: {
    initConfig: initConfigSymbol,
    buildTaskViews: symbolSearchTask,
    audioMapping: assetsSymbol,
    imageAssets: imageAssetsSymbol
  },
};
