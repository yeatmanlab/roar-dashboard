export const DURATIONS = {
  INSTRUCTION: 30_000, // 30 seconds
  BREAK: 180_000, // 3 minutes
  WAIT_FOR_RESPONSE: 600_000, // 10 minutes
  RESPONSE_INPUT_TYPE: 120_000, // 2 minutes
  RESPONSE_INPUT_KEY: 60_000, // 1 minute
  DISABLE_INPUT_SHORT: 500, // 0.5 second
  DISABLE_INPUT_MEDIUM: 1_000, // 1 second
  DISABLE_INPUT_LONG: 2_000, // 2 seconds
  FEEDBACK_MAX: 1_100,
  RESPONSE_MAX: 60_000,
  // @fix-freeze-audio - begin
  // safety net if audio "ended" event is lost (iPad Safari) - should be longer than audio duration;
  // all roav trials with audio and skipped response have parameters to reset the defaults
  AUDIO_END_FALLBACK_LONG: 25_000,
  AUDIO_END_FALLBACK_MEDIUM: 12_000,
  AUDIO_END_FALLBACK_SHORT: 8_000,
  // retry delay to resume audio after minimize / restore (iPad Safari)
  AUDIO_CONTEXT_RESUME_RETRY: 250,
  AUDIO_CONTEXT_RESUME_RETRY_LONG: 500,
  // recheck delay for context settling in and reporting incorrect information
  // after minimize / restore (iPad Safari)
  DELAY_RECHECK_ROTATION_RESIZE: 500,
  // @fix-freeze-audio - end
};

export const FPS_STANDARD = {
  FPS_30: 30,
  FPS_60: 60,
  FPS_75: 75,
  FPS_90: 90,
  FPS_120: 120,
};

export const RATE_AUDIO_LOW = 22050;
