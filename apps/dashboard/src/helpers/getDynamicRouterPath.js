/**
 * Dynamic Router Path
 *
 * Use to generate a router path from a route and a mapping of dynamic parameters.
 *
 * @param {string} route – The APP_ROUTES route to convert.
 * @param {Object} mapping – The mapping of dynamic parameters to their corresponding values.
 * @returns {string} The converted route path.
 */
export const getDynamicRouterPath = (route, mapping) => {
  if (typeof route !== 'string') {
    throw new Error('Route must be a string');
  }

  if (!mapping || typeof mapping !== 'object') {
    throw new Error('Mapping must be an object');
  }

  // Split the route into segments
  const segments = route.split('/');

  // Filter out empty segments
  const filteredSegments = segments.filter((segment) => segment !== '');

  // Replace dynamic parameters with their corresponding values
  const routePath = filteredSegments
    .map((segment) => {
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        return mapping[paramName] || `:${paramName}`;
      }
      return segment;
    })
    .join('/');

  return `/${routePath}`;
};
