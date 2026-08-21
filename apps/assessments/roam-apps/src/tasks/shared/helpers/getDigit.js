//gets the nth digit
export const getDigit = (x, y) => {
  return Math.floor((x % (10 * y)) / y);
};
