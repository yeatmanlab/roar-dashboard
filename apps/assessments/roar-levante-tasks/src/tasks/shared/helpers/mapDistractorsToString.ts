export const mapDistractorsToString = (distractors: Array<number | string>): string[] => {
  return distractors.map((d) => d.toString());
};
