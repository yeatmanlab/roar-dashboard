export const getMemoryGameType = (mode: 'input' | 'display', reverse: boolean, gridSize: number) => {
  let memoryGameType: string;

  if (mode === 'input') {
    memoryGameType = reverse ? 'backward' : 'forward';
  } else {
    memoryGameType = reverse ? 'backward-training' : 'forward-training';
  }

  memoryGameType += '-' + gridSize;

  return memoryGameType;
};
