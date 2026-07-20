import { sessionSet } from '../shared/helpers/sessionHelpers';
import { ET_SESSION_KEYS as SK } from './et_sessionKeys';

// TODO: figure out what should be here - see et_sessionKeys
export const et_clearStoreOnTimelineStart = () => {
  sessionSet(SK.CONFIG_DEVICE, null);
  sessionSet(SK.CALIBR_HT, null);
  sessionSet(SK.CALIBR_ET, null);

  sessionSet(SK.DIST_FOCAL, undefined);

  sessionSet(SK.VIDEO_ENABLED, false);
  sessionSet(SK.DIST_FOCAL_CALIBRATED, false);
  sessionSet(SK.HT_CALIBRATED, false);
  sessionSet(SK.ET_CALIBRATED, false);
};

export const et_clearStoreOnAppStart = () => {
  sessionSet(SK.VIDEO_ENABLE, false);
  sessionSet(SK.VIDEO_RECORD, false);

  sessionSet(SK.HT_RECORD, false);

  sessionSet(SK.ET_CALIBRATE, false);
  sessionSet(SK.ET_RECORD, false);
};
