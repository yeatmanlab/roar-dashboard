interface PathMapping {
  [key: string]: string;
}

/**
 * Generates a dynamic router path by replacing parameters in the route with values from the mapping
 * @param route - The route template with parameters (e.g., '/users/:userId/posts/:postId')
 * @param mapping - Object containing parameter values to replace in the route
 * @returns The generated path with parameters replaced
 * @throws Error if route is not a string or mapping is not an object
 */
export const getDynamicRouterPath = (route: string, mapping: PathMapping): string => {
  if (typeof route !== 'string') {
    throw new Error('Route must be a string');
  }

  if (typeof mapping !== 'object' || mapping === null) {
    throw new Error('Mapping must be an object');
  }

  if (!route) {
    return '/';
  }

  return route.replace(/:(\w+)/g, (match, key) => {
    return mapping[key] || match;
  });
}; 