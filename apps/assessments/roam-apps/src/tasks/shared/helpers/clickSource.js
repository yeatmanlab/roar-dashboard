import store from 'store2';

// Records the pointer type (touch, mouse, or pen) that produced a button
// click, without blocking or altering the response — see click_source in the
// saved trial data. Some plugins (e.g. jsPsychAudioMultiResponse) already
// record their own response_source ("button" vs "keyboard") natively;
// click_source is a separate field that only disambiguates *which kind* of
// click happened, so it's left null for keyboard/assistive-tech activation
// (detail === 0) rather than duplicating what response_source already says.
// containerId must be an ANCESTOR of the clickable element(s), not the
// element itself — capture-phase listeners only run before the target's own
// listeners when attached to an ancestor, regardless of registration order.
// Reset to null on each trial's on_load so a timed-out trial with no click
// doesn't carry over a stale value.
export const trackClickSource = (containerId) => {
  store.session.set('clickSource', null);

  const container = document.getElementById(containerId);
  if (!container || typeof window.PointerEvent === 'undefined') return;

  let lastPointerType = null;

  container.addEventListener(
    'pointerdown',
    (e) => {
      lastPointerType = e.pointerType;
    },
    true,
  );

  container.addEventListener(
    'click',
    (e) => {
      if (e.detail !== 0) {
        store.session.set('clickSource', lastPointerType || null);
      }
      lastPointerType = null;
    },
    true,
  );
};

// Same idea as trackClickSource, but accumulates every click within the
// container into an array (click_source_list) instead of a single value —
// for trials where the scored response is built up from multiple discrete
// taps (e.g. tapping several items to select them) rather than one click.
export const trackClickSourceList = (containerId) => {
  store.session.set('clickSourceList', []);

  const container = document.getElementById(containerId);
  if (!container || typeof window.PointerEvent === 'undefined') return;

  let lastPointerType = null;

  container.addEventListener(
    'pointerdown',
    (e) => {
      lastPointerType = e.pointerType;
    },
    true,
  );

  container.addEventListener(
    'click',
    (e) => {
      if (e.detail !== 0) {
        const list = store.session.get('clickSourceList');
        list.push(lastPointerType || null);
        store.session.set('clickSourceList', list);
      }
      lastPointerType = null;
    },
    true,
  );
};

// simple-keyboard passes the original DOM event into onKeyPress — a
// PointerEvent (with pointerType) for pointer-events-capable browsers, or a
// TouchEvent/MouseEvent as a fallback. (Physical keydown never reaches here:
// simple-keyboard only routes it into onKeyPress when physicalKeyboardHighlight
// / physicalKeyboardHighlightPress are enabled, which these keyboards don't set.)
export const getClickSource = (e) => {
  if (!e) return 'unknown';
  if (e.pointerType) return e.pointerType; // "touch" | "mouse" | "pen"
  if (e.type === 'touchstart' || e.type === 'touchend') return 'touch';
  if (e.type === 'mousedown' || e.type === 'mouseup' || e.type === 'click') return 'mouse';
  return 'unknown';
};
