import { ResourceScopeType } from '../enums/resource-scope-type.enum';

/**
 * ResourceScope
 *
 * Represents the scope of resources a user can access.
 * Used for authorization checks across different resource types.
 */
export type ResourceScope =
  | { type: typeof ResourceScopeType.UNRESTRICTED }
  | { type: typeof ResourceScopeType.SCOPED; ids: string[] };
