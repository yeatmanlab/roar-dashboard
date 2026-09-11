import { AuthorizationModule } from './authorization/authorization.module';

/**
 * SystemService — facade for super-admin system operations.
 *
 * Organizes admin-only operations into namespaced modules. Controllers call
 * `systemService.authorization.syncFgaStore(...)` rather than importing
 * individual service factories.
 *
 * @param authorizationModule - Authorization module (injectable for testing)
 */
export function SystemService({
  authorizationModule = AuthorizationModule(),
}: {
  authorizationModule?: ReturnType<typeof AuthorizationModule>;
} = {}) {
  return {
    authorization: authorizationModule,
  };
}
