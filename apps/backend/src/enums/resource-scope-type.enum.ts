/**
 * Resource Scope Type Enum
 *
 * Defines the types of access scopes for authorization.
 * - UNRESTRICTED: User can access ALL resources
 * - SCOPED: User can only access specific resource IDs
 */
export enum ResourceScopeType {
  UNRESTRICTED = 'unrestricted',
  SCOPED = 'scoped',
}
