import { SESSION_KEYS } from "../../shared/helpers/sessionKeys";
import { ET_SESSION_KEYS } from "../../et/et_sessionKeys";

export const CR_SESSION_KEYS = {
  ...SESSION_KEYS,
  ...ET_SESSION_KEYS,
  CONFIG_QUEST: "configQuest",
  CONFIG_STIM: "configStim",
  MAP_STIM: "mapStim",

  CR_METAPARAMS_BLOCK: "crMetaparamsBlock",
  CR_INFO_BLOCK: "crInfoBlock",
};
