let suppressClick = false;

// adds both click and touchend listeners to a button while preventing them both from firing
export function wrapListeners(button: HTMLButtonElement, action: () => void) {
  button.addEventListener('touchend', () => {
    suppressClick = true;
    void action();
  });
  button.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    void action();
  });
}
