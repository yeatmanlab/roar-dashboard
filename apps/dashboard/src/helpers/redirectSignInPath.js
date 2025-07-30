import { APP_ROUTES } from '../constants/routes';
import { PATH_REGEX } from '../constants/regex';

/**
 * Redirects to the path specified in the redirect_to query parameter if it is a valid path.
 *
 * @param {Object} route - Route object from vue-router
 * @returns {String} - Redirect path
 */
export const redirectSignInPath = (route) => {
  const redirect_to = route.query.redirect_to;

  if (!redirect_to) {
    return APP_ROUTES.HOME;
  }

  if (
    redirect_to.startsWith('/') &&
    !redirect_to.match(PATH_REGEX.HAS_URL_SCHEME) &&
    !redirect_to.match(PATH_REGEX.HAS_INVALID_SLASHES)
  ) {
    return redirect_to;
  }

  return APP_ROUTES.UNAUTHORIZED;
};
