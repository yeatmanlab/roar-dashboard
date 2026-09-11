export function stringToBoolean(str?: string, defaultValue = false) {
  if (str === null || str === undefined) {
    return defaultValue;
  }
  return str.trim().toLowerCase() === 'true';
}
