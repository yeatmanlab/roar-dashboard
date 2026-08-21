export function equalizeButtonSizes(buttons: NodeListOf<HTMLButtonElement>) {
  const buttonWidths = [];
  const buttonHeights = [];

  // get starting button widths
  for (let i = 0; i < buttons.length; i++) {
    const rect = buttons[i].getBoundingClientRect();

    buttonWidths.push(rect.width);
  }

  // resize all buttons to smallest width
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].style.width = Math.min(...buttonWidths).toString() + 'px';
  }

  // get new button heights (after automatically adjusted to accomdate different text)
  for (let i = 0; i < buttons.length; i++) {
    const rect = buttons[i].getBoundingClientRect();
    buttonHeights.push(rect.height);
  }

  // resize all buttons to max height and align with top of container
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].style.height = Math.max(...buttonHeights).toString() + 'px';

    const parentElement = buttons[i].parentElement;
    if (parentElement) {
      parentElement.style.verticalAlign = 'top';
    }
  }
}
