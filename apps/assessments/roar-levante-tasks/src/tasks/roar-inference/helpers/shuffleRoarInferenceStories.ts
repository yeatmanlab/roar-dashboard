import _shuffle from 'lodash/shuffle';

export function shuffleStories(
  corpus: StimulusType[],
  inferenceNumStories: number,
  storyKey: string,
  typesToAvoid: string[],
  numItemsPerStory: number,
) {
  const shuffledStoryCorpus = [];
  const storyMap: Record<string, boolean> = {};

  // Build a unique map of stories excluding types to avoid
  corpus.forEach((c) => {
    const storyName = c[storyKey as keyof typeof c] as string;
    if (!(storyName in storyMap) && !typesToAvoid.includes(storyName)) {
      storyMap[storyName] = true;
    }
  });

  const stories = Object.keys(storyMap);
  const shuffledStories = _shuffle(stories);

  // Process each story up to the number of stories specified
  for (let i = 0; i < inferenceNumStories; i += 1) {
    const story = shuffledStories[i];
    const filteredByStory = corpus.filter((c) => c[storyKey as keyof typeof c] === story);

    if (numItemsPerStory === 1) {
      // Case: numItemsPerStory is 1, shuffle and pick one item
      const singleItem = _shuffle(filteredByStory)[0];
      if (singleItem) {
        shuffledStoryCorpus.push({
          ...singleItem,
          itemId: `${singleItem.itemId}_1`, // Append index to itemId
        });
      }
    } else {
      // Case: numItemsPerStory > 1, ensure one literal and shuffle the rest
      const literalItems = filteredByStory.filter((c) => c.trialType === 'literal');
      const nonLiteralItems = filteredByStory.filter((c) => c.trialType !== 'literal');

      const selectedItems = [];
      if (literalItems.length > 0) {
        selectedItems.push(literalItems[0]); // Pick one literal item
      }

      const remainingItems = _shuffle(nonLiteralItems.concat(literalItems.slice(1))); // Shuffle the rest
      const additionalItemsNeeded = numItemsPerStory - selectedItems.length;

      selectedItems.push(...remainingItems.slice(0, additionalItemsNeeded));

      // Shuffle the final selection to ensure randomness
      const finalSelection = _shuffle(selectedItems);

      // Add items to the shuffledStoryCorpus
      for (let j = 0; j < numItemsPerStory; j += 1) {
        if (finalSelection[j]) {
          shuffledStoryCorpus.push({
            ...finalSelection[j],
            itemId: `${finalSelection[j].itemId}_${j + 1}`, // Append index to itemId
          });
        }
      }
    }
  }

  // Include items to avoid (non-story items)
  const nonStoryItems = corpus.filter((c) => typesToAvoid.includes(c[storyKey as keyof typeof c] as string));

  return [...nonStoryItems, ...shuffledStoryCorpus];
}
