import { sessionSet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from './rvp_sessionKeys';
import { clearStoreOnAppStartDef, clearStoreOnTimelineStartDef, initStore } from '../../shared/helpers/initStore';

export const rvp_clearStoreOnTimelineStart = () => {
  clearStoreOnTimelineStartDef();
  sessionSet(SK.RVP_METAPARAMS_BLOCK, undefined);
  sessionSet(SK.RVP_INFO_BLOCK, undefined);
  sessionSet(SK.RVP_ARR_METAPARAMS_TRIAL, undefined);
  sessionSet(SK.IND_BLOCK_ADAPT, 0);
  sessionSet(SK.CNT_BLOCK_REPEAT, 0);
};

export const rvp_clearStoreOnAppStart = () => {
  clearStoreOnAppStartDef();

  sessionSet(SK.CONFIGS_STIM, null);
  sessionSet(SK.MAPS_STIM, null);
};

export const rvp_initStore = () => initStore(rvp_clearStoreOnAppStart, rvp_clearStoreOnTimelineStart);
