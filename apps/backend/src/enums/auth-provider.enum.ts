/**
 * Auth Provider Enum
 *
 * Enumerates the available authentication providers.
 */
enum AuthProvider {
  PASSWORD = 'password',
  OIDC_CLEVER = 'oidc.clever',
  OIDC_CLASSLINK = 'oidc.classlink',
  OIDC_NYCPS = 'oidc.nycps',
  GOOGLE = 'google',
}

export default AuthProvider;
