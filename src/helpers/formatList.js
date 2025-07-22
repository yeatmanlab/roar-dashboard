/**
 * Turn an array of keys into a formatted, ordered, human-readable string.
 *
 * @param {Array} items – The items to format.
 * @param {Object} lookup – The lookup object to map items to entries.
 * @param {Function} displayMapper – The mapper function to convert items to display strings.
 * @param {Object} [options] - Optional parameters
 * @param {Object} [options.orderLookup]
 * @param {Function} [options.orderExtractor]  - (item, entry) => number
 * @param {string} [options.separator=', ']
 * @param {string} [options.suffix='']
 * @returns {string}
 */
export const formatList = (
  items,
  lookup,
  displayMapper,
  { orderLookup = null, orderExtractor = null, separator = ', ', suffix = '' } = {},
) => {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  // Determine the sorting function, if any
  const getWeight =
    orderExtractor ||
    (orderLookup
      ? (item) => {
          const val = orderLookup[item];
          return val != null && typeof val === 'number' ? val : 0;
        }
      : null);

  // Sort if we have a weight function
  const sorted = getWeight ? [...items].sort((a, b) => getWeight(a, lookup[a]) - getWeight(b, lookup[b])) : items;

  return sorted.map((item) => displayMapper(item, lookup[item])).join(separator) + suffix;
};
