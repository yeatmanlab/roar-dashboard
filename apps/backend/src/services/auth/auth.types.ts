/**
 * Decoded User JWT interface.
 *
 * @property uid - The user ID.
 * @property email - The user email.
 * @property claims - The user claims.
 */
export type DecodedUser = {
  uid: string;
  email?: string;
  claims: Record<string, unknown>;
};
