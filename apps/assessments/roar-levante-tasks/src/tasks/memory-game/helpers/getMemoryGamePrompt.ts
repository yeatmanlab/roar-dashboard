import { taskStore } from '../../../taskStore';

export function getMemoryGamePrompt(mode: 'display' | 'input', reverse: boolean) {
  const inputAudioPrompt = reverse
    ? taskStore().heavyInstructions
      ? 'memoryGameInstruct11Downex'
      : 'memoryGameBackwardPrompt'
    : taskStore().heavyInstructions
    ? 'memoryGameInstruct8Downex'
    : 'memoryGameInput';
  const displayAudioPrompt = taskStore().heavyInstructions ? 'memoryGameInstruct7Downex' : 'memoryGameDisplay';

  const prompt = mode === 'display' ? displayAudioPrompt : inputAudioPrompt;

  return prompt;
}
