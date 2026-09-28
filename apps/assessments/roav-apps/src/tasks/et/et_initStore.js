import { sessionSet } from "../shared/helpers/sessionHelpers";
import { ET_SESSION_KEYS as SK } from "./et_sessionKeys";

export const et_clearStoreOnTimelineStart = () => {
  sessionSet(SK.VIDEO_ENABLE, false);
  sessionSet(SK.VIDEO_RECORD, false);
  sessionSet(SK.VIDEO_ENABLED, false);

  sessionSet(SK.CAMERA_CONFIRMED, false);

  sessionSet(SK.ET_CALIBRATE, false);
  sessionSet(SK.ET_ENABLE, false);

  sessionSet(SK.VD_CALIBRATE, false);

  sessionSet(SK.SHOW_GAZE, false);

  // currently unused
  sessionSet(SK.HT_RECORD, false);
  sessionSet(SK.ET_RECORD, false);

  sessionSet(SK.VD_RECORD, false);
  sessionSet(SK.VD_FEEDBACK, false);
  sessionSet(SK.HT_FEEDBACK, false);
};

export const et_clearStoreOnAppStart = () => {
  sessionSet(SK.CONFIG_ET, null);
};
