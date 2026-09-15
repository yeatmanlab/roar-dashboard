export function stringToBoolean(str, defaultValue = false) {
  if (str === null || str === undefined) {
    return defaultValue;
  }
  return str.trim().toLowerCase() === 'true';
}

/**
 * Checks if value is a string and converts it to boolean, handling both string and boolean inputs
 * @param {string|boolean} value - The value to check and convert
 * @returns {boolean} The boolean value
 */
export function checkBoolean(value) {
  if (typeof value === 'string') {
    return stringToBoolean(value);
  }
  return typeof value === 'boolean' ? value : false;
}
