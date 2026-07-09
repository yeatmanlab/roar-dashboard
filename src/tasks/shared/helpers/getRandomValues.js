import { shuffle } from "./shuffleArray";
//gets n random values from array
export const getRandomValues = (arr, n) => {
  arr = shuffle(arr);
  return arr.slice(0, n);
};
