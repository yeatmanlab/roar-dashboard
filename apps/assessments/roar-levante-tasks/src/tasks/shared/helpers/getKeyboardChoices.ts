// Maps the number of response options to the keyboard keys that select them.
// Kept dependency-free (no app/DOM imports) so it can be unit-tested in isolation.
export const getKeyboardChoices = (itemConfig: LayoutConfigType) => {
  const buttonLength = itemConfig.response.values.length;
  if (buttonLength === 1) {
    // instruction trial
    return ['Enter'];
  }
  if (buttonLength === 2) {
    return ['ArrowLeft', 'ArrowRight'];
  }
  if (buttonLength === 3) {
    return ['ArrowUp', 'ArrowLeft', 'ArrowRight'];
  }
  if (buttonLength === 4) {
    return ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'];
  }
  throw new Error('More than 4 buttons are not supported yet');
};
