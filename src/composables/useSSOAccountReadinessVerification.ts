import { ref, onUnmounted, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
// @ts-ignore - Store file is JS
import { useAuthStore } from '@/store/auth.js';
// @ts-ignore - Query composable file is JS
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import { AUTH_USER_TYPE } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';

const POLLING_INTERVAL = 600;

// Define expected structure for userData.value
interface UserData {
  userType: string | undefined | null;
  // Add other properties if known
}

// Define structure for errors caught, assuming a status property
interface ApiError extends Error {
  status?: number;
}

// Define return type for the composable
interface UseSSOAccountReadinessVerificationReturn {
  retryCount: Ref<number>;
  startPolling: () => void;
}

/**
 * Verify account readiness after SSO authentication.
 *
 * This composable is an abstraction of the currently implemented logic in the SSO callback pages. Following SSO
 * authentication, the application's backend creates a user document and populates it in the database. As this document
 * is required before being able to utilize the application, this composable is designed to poll the user document until
 * it is ready for use and then redirect the user to the home page.
 *
 * @TODO: Implement a MAX_RETRY_COUNT to prevent infinite polling, incl. a redirect to an error page.
 * @TODO: Consider refactoring this function to leverage an alternative mechanism such as realtime updates from
 * Firestore instead of the current polling logic.
 */
const useSSOAccountReadinessVerification = (): UseSSOAccountReadinessVerificationReturn => {
  const retryCount: Ref<number> = ref(1);
  let userDataCheckInterval: NodeJS.Timeout | null = null;

  const router = useRouter();
  const queryClient = useQueryClient();

  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const { data: userData, refetch: refetchUserData, isFetchedAfterMount }: {
    data: Ref<UserData | null | undefined>;
    refetch: () => Promise<any>;
    isFetchedAfterMount: Ref<boolean>;
  } = useUserDataQuery();

  /**
   * Verify account readiness after SSO authentication.
   *
   * This function checks if the user type is both available and the expected value. This function is called as part of
   * a polling mechanism whilst we await for the user document to be created and ready for use following single sign-on.
   *
   * @returns {Promise<void>}
   * @throws {Error} Throws any but ERR_BAD_REQUEST errors.
   */
  const verifyAccountReadiness = async (): Promise<void> => {
    try {
      // Skip the first fetch after mount as data is fetched on mount in the useUserDataQuery composable.
      if (isFetchedAfterMount.value) {
        await refetchUserData();
      }

      const userType = userData?.value?.userType;

      if (!userType) {
        console.log(`[SSO] User type missing for user ${roarUid.value}. Attempt #${retryCount.value}, retrying...`);
        retryCount.value++;
        return;
      }

      if (userType === AUTH_USER_TYPE.GUEST) {
        console.log(
          `[SSO] User ${roarUid.value} identified as ${userType} user. Attempt #${retryCount.value}, retrying...`,
        );
        retryCount.value++;
        return;
      }

      console.log(`[SSO] User ${roarUid.value} successfully identified as ${userType} user. Routing to home page...`);

      // Stop the polling mechanism.
      if (userDataCheckInterval) clearInterval(userDataCheckInterval);

      // Invalidate all queries to ensure data is fetched freshly after the user document is ready.
      // @TODO: Check if this is actually necessary and if so, if we should only invalidate specific queries.
      await queryClient.invalidateQueries();

      // Redirect to the home page.
      await router.push({ path: APP_ROUTES.HOME });
    } catch (error: unknown) {
      // Type cast error to check status property
      const apiError = error as ApiError;
      // If the error is a 401, we assume the backend is still processing the user document setup and we should retry.
      if (apiError.status === StatusCodes.UNAUTHORIZED) return;

      // Otherwise throw the error as it's unexpected.
      console.error("[SSO] Unexpected error during account readiness check:", error);
      throw error;
    }
  };

  /**
   * Starts polling to check for the user type after SSO authentication.
   *
   * @returns {void}
   */
  const startPolling = (): void => {
    if (userDataCheckInterval) clearInterval(userDataCheckInterval);
    userDataCheckInterval = setInterval(verifyAccountReadiness, POLLING_INTERVAL);
  };

  /**
   * Cleanup function to stop polling when the component is unmounted.
   *
   * @returns {void}
   */
  const stopPolling = (): void => {
    if (userDataCheckInterval) clearInterval(userDataCheckInterval);
  };

  onUnmounted(() => {
    stopPolling();
  });

  return {
    retryCount,
    startPolling,
  };
};

export default useSSOAccountReadinessVerification;
