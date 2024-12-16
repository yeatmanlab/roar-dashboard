import { camelCase } from 'lodash';

/**
 * Converts an array of task parameters to a key-value object.
 *
 * @param {Array} paramArray – The array of task parameters to be converted to an object.
 * @returns {Object} – The object representation of the task parameters.
 */
export const convertParamArrayToObject = (paramArray) => {
  const target = paramArray.value !== undefined ? paramArray.value : paramArray;

  return target.reduce((acc, item) => {
    if (item.name) {
      acc[camelCase(item.name)] = item.value;
    }
    return acc;
  }, {});
};
