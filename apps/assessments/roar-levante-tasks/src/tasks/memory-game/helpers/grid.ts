import { mediaAssets } from '../../..';

type CreateGridArgs = {
  x: number;
  y: number;
  numOfBlocks: number;
  blockSize: number;
  gridSize: number;
  blockSpacing: number;
};

type RandomSequenceArgs = {
  numOfBlocks: number;
  sequenceLength: number;
  previousSequence: number[] | null;
};
export function createGrid({ x, y, numOfBlocks, blockSize, gridSize, blockSpacing }: CreateGridArgs) {
  const blocks = [];
  const numRows = gridSize;
  const numCols = numOfBlocks / gridSize;

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const blockX = x + col * (blockSize + blockSpacing);
      const blockY = y + row * (blockSize + blockSpacing);
      blocks.push({ x: blockX, y: blockY });
    }
  }

  return blocks;
}

export function generateRandomSequence({ numOfBlocks, sequenceLength, previousSequence = null }: RandomSequenceArgs) {
  const sequence: number[] = [];

  for (let i = 0; i < sequenceLength; i++) {
    const randomNumber = Math.floor(Math.random() * numOfBlocks);

    // Avoid highlighting the same square twice in a row,
    // even across trial sequences

    // Check the last square in the previous sequence
    if (i == 0 && previousSequence && previousSequence[previousSequence.length - 1] === randomNumber) {
      i--;
      continue;
    }

    // Check the previous square in the current sequence
    if (sequence[sequence.length - 1] === randomNumber) {
      i--;
      continue;
    }

    sequence.push(randomNumber);
  }

  return sequence;
}

function addAnimation(element: HTMLDivElement, animation?: 'pulse' | 'cursor') {
  if (animation === 'cursor') {
    const cursorImageSrc = mediaAssets.images.cursor;

    // Ensure element has position relative for absolute positioning of cursor image
    if (
      element.style.position !== 'relative' &&
      element.style.position !== 'absolute' &&
      element.style.position !== 'fixed'
    ) {
      element.style.position = 'relative';
    }

    // Remove existing cursor image if it exists
    removeCursorImage(element);

    // Create and add cursor image
    const cursorImg = document.createElement('img');
    cursorImg.src = cursorImageSrc;
    cursorImg.className = 'corsi-cursor-image';
    cursorImg.style.position = 'absolute';
    cursorImg.style.top = '50%';
    cursorImg.style.left = '50%';
    cursorImg.style.transform = 'translate(-50%, -50%)';
    cursorImg.style.pointerEvents = 'none';
    cursorImg.style.zIndex = '10';

    cursorImg.style.animation = 'pulse 2s infinite';

    element.appendChild(cursorImg);
  } else if (animation === 'pulse') {
    element.style.animation = 'pulse 2s infinite';
    element.style.backgroundColor = '#275BDD';
  }
}

// removes the cursor image from a corsi block element if it exists
function removeCursorImage(element: HTMLDivElement) {
  const existingCursor = element.querySelector('.corsi-cursor-image') as HTMLImageElement;
  if (existingCursor) {
    existingCursor.remove();
  }
}

// enables a corsi block element, making it clickable and fully visible, and also adds an animation
export function enableBlock(element: HTMLDivElement, animation?: 'pulse' | 'cursor') {
  element.style.pointerEvents = 'auto';
  element.style.opacity = '1';
  element.style.cursor = 'pointer';
  element.style.backgroundColor = ' #ffffffcc';

  if (animation) {
    addAnimation(element, animation);
  }
}

// disables a corsi block element, making it non-clickable and visually dimmed
export function disableBlock(element: HTMLDivElement) {
  element.style.pointerEvents = 'none';
  element.style.opacity = '0.5';
  element.style.cursor = 'not-allowed';
  element.style.backgroundColor = 'rgba(215, 215, 215, 0.93)';

  // disable any ongoing animations
  removeCursorImage(element);
  element.style.animation = 'none';
}
