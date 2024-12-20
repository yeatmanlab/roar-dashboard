/**
 * Converts an object to an array of objects with name, value, and type properties.
 *
 * @param {Object} obj - The object to be converted.
 * @returns {Array} - An array of objects with name, value, and type properties.
 */
export const convertObjectToParamArray = (obj) => {
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value,
    type: typeof value,
  }));
};
