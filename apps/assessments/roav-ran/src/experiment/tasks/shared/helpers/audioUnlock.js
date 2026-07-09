let _ctx = null;

export function getAudioContextState() {
  return _ctx ? _ctx.state : "not created";
}

export function unlockAudio() {
  if (_ctx) return;
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _ctx.resume().catch(() => {});

    // Play a silent 1-frame buffer to mark this document as gesture-authorized.
    const buf = _ctx.createBuffer(1, 1, 22050);
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    src.connect(_ctx.destination);
    src.start(0);

    // Keep the context permanently alive with a silent oscillator (near-zero gain).
    // An AudioContext with at least one active processing node never idles into
    // auto-suspension, so Chrome never re-applies the autoplay policy during
    // the gesture-free read-aloud test phases.
    const osc = _ctx.createOscillator();
    const gain = _ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(_ctx.destination);
    osc.start();

    // Belt-and-suspenders: if the context is ever suspended or interrupted (iOS
    // fires 'interrupted' when the audio session is taken over), resume it.
    _ctx.addEventListener("statechange", () => {
      if (_ctx.state === "suspended" || _ctx.state === "interrupted") {
        _ctx.resume().catch(() => {});
      }
    });

    // Expose helpers for inline HTML scripts that can't import ES modules.
    window._resumeAudioContext = resumeAudioContext;
    window._whenAudioContextRunning = whenRunning;
    window._getAudioContextState = getAudioContextState;
    window._getAudioContext = () => _ctx;
  } catch (_) {}
}

// Ensure the context is running before play() is called. Returns a Promise
// that resolves once the context is in the 'running' state (or immediately
// if it already is).
export function resumeAudioContext() {
  if (!_ctx || _ctx.state === "running") return Promise.resolve();
  return _ctx.resume().catch(() => {});
}

// Returns a Promise that resolves only once the AudioContext is in the
// 'running' state. Unlike resumeAudioContext(), this waits for any in-flight
// iOS audio session interruption to finish before resolving, preventing the
// race where play() is called while the context is momentarily 'interrupted'.
export function whenRunning() {
  if (!_ctx || _ctx.state === "running") return Promise.resolve();
  return new Promise((resolve) => {
    function handler() {
      if (_ctx.state === "running") {
        _ctx.removeEventListener("statechange", handler);
        resolve();
      }
    }
    _ctx.addEventListener("statechange", handler);
    _ctx.resume().catch(() => {});
  });
}
