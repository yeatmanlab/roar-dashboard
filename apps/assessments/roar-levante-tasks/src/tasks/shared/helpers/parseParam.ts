/**
 * Parses a parameter value into a number with fallback to a default value.
 * If no default value is provided, 0 is used.
 *
 * @param paramVal - The value to parse. Can be a number, string, undefined, or null.
 * @param defaultValue - The default value to return if parsing fails or input is invalid. Defaults to 0.
 * @returns The parsed number or the default value.
 */
export const parseNumberParam = (paramVal: string | number | undefined | null, defaultValue: number = 0): number => {
  if (typeof paramVal === 'undefined' || paramVal === null) {
    return defaultValue;
  }

  if (typeof paramVal === 'number') {
    return paramVal;
  }

  const parsedString = paramVal.trim();

  if (parsedString !== '') {
    return Number.isNaN(Number(parsedString)) ? defaultValue : Number(parsedString);
  }

  return defaultValue;
};
