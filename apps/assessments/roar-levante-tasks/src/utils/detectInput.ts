type InputType = 'touch' | 'mouse' | 'keyboard' | 'unknown';

export interface InputCapability {
  touch: boolean;
  mouse: boolean;
  primary: InputType;
}

interface InputDetector {
  capability: InputCapability;
  getCurrentInput: () => InputType | null;
}

export function setupInputDetection(): InputDetector {
  const mq = (query: string): boolean => window.matchMedia(query).matches;

  // --- Capability snapshot
  const capability: InputCapability = {
    touch: navigator.maxTouchPoints > 0 || mq('(any-pointer: coarse)'),

    mouse: mq('(any-pointer: fine)'),

    primary: mq('(pointer: coarse)') ? 'touch' : mq('(pointer: fine)') ? 'mouse' : 'unknown',
  };

  let lastTouchTime = 0;
  let currentInput: InputType | null = null;

  const setInput = (type: InputType) => {
    if (currentInput === type) return;
    currentInput = type;
    document.documentElement.dataset.input = type;
  };

  // --- Interaction detection
  window.addEventListener(
    'touchstart',
    () => {
      lastTouchTime = Date.now();
      setInput('touch');
    },
    { passive: true },
  );

  window.addEventListener('mousemove', () => {
    // Ignore fake mouse events after touch
    if (Date.now() - lastTouchTime < 500) return;
    setInput('mouse');
  });

  window.addEventListener('keydown', () => {
    setInput('keyboard');
  });

  // --- Initial guess
  if (capability.primary !== 'unknown') {
    setInput(capability.primary);
  }

  return {
    capability,
    getCurrentInput: () => currentInput,
  };
}
