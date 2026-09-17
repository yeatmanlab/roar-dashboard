import { isTouchScreen } from '../../taskSetup';
import { arrowKeyEmojis, multipleArrowKeyEmojis } from './components';
import { taskStore } from '../../../taskStore';

// Adds key helper icons to buttons (centered inside) (left, right)
export function addKeyHelpers(el: HTMLElement, keyIndex: number, keyEmojis: string[][] = arrowKeyEmojis) {
  if (!isTouchScreen) {
    const arrowKeyBorder = document.createElement('div');
    arrowKeyBorder.classList.add('arrow-key-border');
    arrowKeyBorder.style.position = 'absolute';
    arrowKeyBorder.style.inset = '0';
    arrowKeyBorder.style.display = 'flex';
    arrowKeyBorder.style.justifyContent = 'center';
    arrowKeyBorder.style.alignItems = 'center';

    el.style.position = 'relative';

    const arrowKey = document.createElement('p');
    arrowKey.innerHTML = keyEmojis[keyIndex][1];
    arrowKey.style.textAlign = 'center';
    arrowKey.style.margin = '0';
    arrowKeyBorder.appendChild(arrowKey);
    el.appendChild(arrowKeyBorder);
  }
}

// Adds key helper icons that sits outside the button (left, right, up, down)
export function addKeyIconHelpers(el: HTMLElement, keyIndex: number) {
  const { keyHelpers } = taskStore();
  if (keyHelpers && !isTouchScreen) {
    const arrowKeyBorder = document.createElement('div');
    arrowKeyBorder.classList.add('arrow-key-border');

    const arrowKey = document.createElement('p');
    arrowKey.innerHTML = multipleArrowKeyEmojis[keyIndex][1];
    arrowKey.style.textAlign = 'center';
    arrowKey.style.margin = '0';
    arrowKeyBorder.appendChild(arrowKey);
    el.appendChild(arrowKeyBorder);
  }
}
