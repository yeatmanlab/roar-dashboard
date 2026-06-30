export function stringToNumberArray(inputString: string) {
  // Trim the input string to remove leading and trailing spaces
  const trimmedInput = inputString.trim();

  // Check if the trimmed input is empty
  if (trimmedInput === '') {
    return [];
  }

  // Split the trimmed input string by commas
  const stringArray = trimmedInput.split(',');

  // Convert each element to a number
  const numberArray = stringArray.map((str) => parseFloat(str));

  return numberArray;
}
