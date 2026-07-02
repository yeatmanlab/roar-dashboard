import { displaceAnimation, triggerAnimation } from '../../shared/helpers';

export function animate(animation: string, itemToAnimate: string) {
  if (animation == 'pulse') {
    const elementToAnimate = document.getElementById(itemToAnimate);

    return triggerAnimation(elementToAnimate, 'pulse 2s 0s');
  } else if (animation == 'drag') {
    const elementToAnimate = document.getElementById('stim-image');
    const dragTargetElement = document.getElementById(itemToAnimate);
    const blackOutImage = itemToAnimate === 'target';

    return displaceAnimation(
      dragTargetElement as HTMLElement,
      elementToAnimate as HTMLElement,
      'destination',
      0,
      0,
      false,
      blackOutImage,
    );
  }
}
