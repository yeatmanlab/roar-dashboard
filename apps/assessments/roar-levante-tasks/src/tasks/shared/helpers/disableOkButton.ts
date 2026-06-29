export function disableOkButton() {
  const okButton: HTMLButtonElement | null = document.querySelector('.primary');
  if (okButton != null) {
    okButton.disabled = true;
  }
}
