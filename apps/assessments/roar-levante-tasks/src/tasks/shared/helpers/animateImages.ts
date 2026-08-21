import { mediaAssets } from '../../..';

export function popAnimation(itemsToAnimate: any, animation: string) {
  const item = itemsToAnimate.pop();

  if (!item) {
    return; // Exit early if no item to animate
  }

  triggerAnimation(item, animation);

  return itemsToAnimate;
}

export function triggerAnimation(item: any, animation: string) {
  if (item instanceof Array) {
    item.forEach((item) => {
      item.style.animation = 'none';
      item.offsetHeight; // Force reflow
      item.style.animation = animation;
    });
  } else {
    item.style.animation = 'none';
    item.offsetHeight; // Force reflow
    item.style.animation = animation;
  }
}

// drags the target element to fill in the missing space in the stimulus image
export function displaceAnimation(
  destination: HTMLElement,
  origin: HTMLElement,
  cursorTarget: 'origin' | 'destination',
  offSetX: number = 0,
  offSetY: number = 0,
  leaveCopyInPlace: boolean,
  blackOutImage = false,
) {
  const addCursorPulse = () => {
    const rect = cursorTarget === 'origin' ? origin.getBoundingClientRect() : destination.getBoundingClientRect();
    const cursorImg = document.createElement('img');
    cursorImg.src = mediaAssets.images.pointingHand;
    cursorImg.style.position = 'absolute';
    cursorImg.style.width = rect.width * 0.7 + 'px';
    cursorImg.style.height = 'auto';
    cursorImg.style.left = `${rect.left + rect.width / 4}px`;
    cursorImg.style.top = `${rect.top + rect.height / 4}px`;
    cursorImg.style.pointerEvents = 'none';
    cursorImg.style.zIndex = '20';
    cursorImg.style.animation = 'pulse 2s 1';

    document.body.appendChild(cursorImg);

    window.setTimeout(() => {
      startDragAnimation();
    }, 2000);

    window.setTimeout(() => {
      cursorImg.remove();
    }, 4000);
  };

  const startDragAnimation = () => {
    const transitionDuration = 1000;

    // Get current position of the target button
    const currentRect = origin.getBoundingClientRect();
    const startX = currentRect.left;
    const startY = currentRect.top;

    let animatedTarget: HTMLElement;

    if (leaveCopyInPlace) {
      // create a non-interactive copy to animate
      animatedTarget = origin.cloneNode(true) as HTMLElement;
      animatedTarget.id = 'animated-target';
      animatedTarget.style.position = 'absolute';
      animatedTarget.style.transition = `opacity ${transitionDuration}ms ease`;
      animatedTarget.style.opacity = '1';
      animatedTarget.style.left = `${startX}px`;
      animatedTarget.style.top = `${startY}px`;

      // gray out the original button
      origin.style.transition = `opacity ${transitionDuration}ms ease`;
      origin.classList.add('image-grayed-out');

      const animationParent = origin.parentElement ?? document.body;
      animationParent.appendChild(animatedTarget);
    } else {
      animatedTarget = origin;
      animatedTarget.style.position = 'absolute';
      animatedTarget.style.transition = `opacity ${transitionDuration}ms ease`;
    }

    // Function to update position based on stimImage
    const updatePosition = () => {
      const rect = destination.getBoundingClientRect();
      const targetPositionX = rect.left + rect.width * offSetX;
      const targetPositionY = rect.top + rect.height * offSetY;
      animatedTarget.style.left = `${targetPositionX}px`;
      animatedTarget.style.top = `${targetPositionY}px`;
    };

    const fadeOutThenMove = () => {
      animatedTarget.style.opacity = '0';
      setTimeout(() => {
        updatePosition();
        requestAnimationFrame(() => {
          animatedTarget.style.opacity = '1';
        });
      }, transitionDuration);

      window.setTimeout(() => {
        if (blackOutImage) {
          // replace the target image with a black background to give the illusion that the bunny fits perfectly for mental rotation
          (destination.children[0] as HTMLImageElement).src = mediaAssets.images.blackBackground;
          animatedTarget.style.zIndex = '10';
        }
      }, transitionDuration * 2);
    };

    fadeOutThenMove();

    window.addEventListener('resize', updatePosition);
  };

  addCursorPulse();
}
