/**
 * Turn an array of keys into an ordered array of human-readable display strings.
 * Mirrors the ordering semantics of formatList (missing weights default to 0).
 *
 * @param {Array} items – The items to format.
 * @param {Object} lookup – The lookup object to map items to entries.
 * @param {Function} displayMapper – The mapper function to convert items to display strings.
 * @param {Object} [options]
 * @param {Object} [options.orderLookup]
 * @param {Function} [options.orderExtractor]  - (item, entry) => number
 * @returns {Array<string>} The formatted, ordered array.
 */
export const formatListArray = (items, lookup, displayMapper, { orderLookup = null, orderExtractor = null } = {}) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
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

  // Sort if we have a weight function (V8's sort is stable; ties preserve original order)
  const sorted = getWeight ? [...items].sort((a, b) => getWeight(a, lookup?.[a]) - getWeight(b, lookup?.[b])) : items;

  return sorted.map((item) => displayMapper(item, lookup?.[item]));
};
