export function enableOkButton() {
  const okButton: HTMLButtonElement | null = document.querySelector('.primary');
  if (okButton != null) {
    okButton.disabled = false;
  }
}

export function enableAllButtons() {
  const buttons: NodeListOf<HTMLButtonElement> = document.querySelectorAll('button');

  buttons.forEach((button) => {
    if (button.disabled) {
      button.disabled = false;
    }
  });
}
