import { ResourceScopeType } from '../enums/resource-scope-type.enum';
import type { ResourceScope } from '../types/resource-scope';

/**
 * Type guard to check if scope grants unrestricted access to all resources.
 */
export function isUnrestrictedResource(scope: ResourceScope): scope is { type: typeof ResourceScopeType.UNRESTRICTED } {
  return scope.type === ResourceScopeType.UNRESTRICTED;
}

/**
 * Type guard to check if scope is limited to specific resource IDs.
 */
export function isScopedResource(
  scope: ResourceScope,
): scope is { type: typeof ResourceScopeType.SCOPED; ids: string[] } {
  return scope.type === ResourceScopeType.SCOPED;
}
