import { PermissionsService, Permissions, UserRoles } from '@bdelab/roar-firekit';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import * as Sentry from '@sentry/vue';

// Local Firebase Auth emulator mode (VITE_FIREBASE_EMULATOR_ENABLED). Inert in
// deployed builds; see userCan for why it changes permission evaluation.
const isFirebaseEmulatorEnabled =
  import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === true || import.meta.env.VITE_FIREBASE_EMULATOR_ENABLED === 'true';

export function usePermissions() {
  const userCan = (permission) => {
    if (permission === undefined || permission === null) {
      Sentry.captureException(new Error('Tried to evaluate a permission that is undefined or null.'));
      return false;
    }

    // Note: Creating a new instance of authStore on every invokation of userCan is suboptimal.
    // Moving the following two lines outside the function will prevent the app from loading.
    // Fixing this issue is a TODO.
    const authStore = useAuthStore();
    const { accessToken } = storeToRefs(authStore);

    // If there's no access token yet, we cannot evaluate permissions.
    // Return false to prevent permission checks before authentication is complete.
    if (!accessToken.value) {
      return false;
    }

    // Local emulator mode: firekit's `setUidClaims` Cloud Function doesn't run, so
    // the emulator-issued token carries no role claim and PermissionsService treats
    // every user as `guest` — which would bounce super admins off admin routes.
    // Grant the super admin (derived from /me; see resolveUserClaims) full access so
    // those routes are reachable for local testing. Inert in deployed builds.
    // TODO(firekit-removal): route permissions should come from the backend rather
    // than firekit's token claims; this branch goes away with firekit.
    if (isFirebaseEmulatorEnabled && authStore.isUserSuperAdmin) {
      return true;
    }

    return PermissionsService.canUser(accessToken.value, permission);
  };

  return {
    userCan,
    Permissions,
    UserRoles,
  };
}
