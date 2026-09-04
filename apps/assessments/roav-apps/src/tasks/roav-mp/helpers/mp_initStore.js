import { sessionSet } from '../../shared/helpers/sessionHelpers';
import { MP_SESSION_KEYS as SK } from './mp_sessionKeys';
import { clearStoreOnAppStartDef, clearStoreOnTimelineStartDef, initStore } from '../../shared/helpers/initStore';

export const mp_clearStoreOnTimelineStart = () => {
  clearStoreOnTimelineStartDef();
  sessionSet(SK.RDK_RESPONSE_LAST, null);
  sessionSet(SK.RDK_METAPARAMS_BLOCK, {});
  sessionSet(SK.RDK_INFO_BLOCK, {});
};

const mp_clearStoreOnAppStart = () => {
  clearStoreOnAppStartDef();
  sessionSet(SK.RDK_CONFIG_BLOCK, {});
  sessionSet(SK.RDK_CONFIG_QUEST, {});
};

export const mp_initStore = () => initStore(mp_clearStoreOnAppStart, mp_clearStoreOnTimelineStart);
