import { ref } from 'vue';
export function useCapsLock() {
  const capsLockEnabled = ref(false);
  function checkForCapsLock(e) {
    if (e?.getModifierState) capsLockEnabled.value = e.getModifierState('CapsLock');
  }
  return { capsLockEnabled, checkForCapsLock };
}
