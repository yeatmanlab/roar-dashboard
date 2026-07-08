import { sessionSet } from "../../shared/helpers/sessionHelpers";
import { CR_SESSION_KEYS as SK } from "./cr_sessionKeys";
import {
  clearStoreOnAppStartDef,
  clearStoreOnTimelineStartDef,
  initStore,
} from "../../shared/helpers/initStore";
import {
  et_clearStoreOnAppStart,
  et_clearStoreOnTimelineStart,
} from "../../et/et_initStore";

export const cr_clearStoreOnTimelineStart = () => {
  clearStoreOnTimelineStartDef();
  et_clearStoreOnTimelineStart();
  sessionSet(SK.CR_METAPARAMS_BLOCK, null);
  sessionSet(SK.CR_INFO_BLOCK, null);
};

export const cr_clearStoreOnAppStart = () => {
  clearStoreOnAppStartDef();
  et_clearStoreOnAppStart();
  sessionSet(SK.CONFIG_STIM, null);
  sessionSet(SK.MAP_STIM, null);
  sessionSet(SK.CONFIG_QUEST, null);
};

export const cr_initStore = () =>
  initStore(cr_clearStoreOnAppStart, cr_clearStoreOnTimelineStart);
