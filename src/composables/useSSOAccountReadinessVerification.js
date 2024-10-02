import { ref, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth.js';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import { AUTH_USER_TYPE } from '@/constants/auth';
import { APP_ROUTES } from '@/constants/routes';

const POLLING_INTERVAL = 600;

/**
 * Verify account readiness after SSO authentication.
 *
 * This composable is an abstraction of the currently implemented logic in the SSO callback pages. Following SSO
 * authentication, the application's backend creates a user document and populates it in the database. As this document
 * is required before being able to utilize the application, this composable is designed to poll the user document until
 * it is ready for use and then redirect the user to the home page.
 *
 * @TODO: Check what "guest" user type means?
 * @TODO: Check if we can fetch the user type from the userClaims query instead of the user document?
 * @TODO: Check why we're only throwing an error if the error code is not 'ERR_BAD_REQUEST'?
 * @TODO: Consider refactoring this function to leverage realtime updates from Firestore instead of polling.
 */
const useSSOAccountReadinessVerification = () => {
  const retryCount = ref(0);
  let userDataCheckInterval = null;

  const router = useRouter();
  const queryClient = useQueryClient();

  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const { data: userData, refetch: refetchUserData, isFetchedAfterMount } = useUserDataQuery();

  /**
   * Verify account readiness after SSO authentication.
   *
   * This function checks if the user type is both available and the expected value. This function is called as part of
   * a polling mechanism whilst we await for the user document to be created and ready for use following single sign-on.
   *
   * @returns {Promise<void>}
   * @throws {Error} Throws any but ERR_BAD_REQUEST errors.
   */
  const verifyAccountReadiness = async () => {
    try {
      // Skip the first fetch after mount as data is fetched on mount in the useUserDataQuery composable.
      if (!isFetchedAfterMount.value) {
        await refetchUserData();
      }

      const userType = userData?.value?.userType;

      if (!userType) {
        console.log(`User type missing for user ${roarUid.value}. Attempt #${retryCount.value}, retrying...`);
        retryCount.value++;
        return;
      }

      if (userType === AUTH_USER_TYPE.GUEST) {
        console.log(`User ${roarUid.value} identified as ${userType} user. Attempt #${retryCount.value}, retrying...`);
        retryCount.value++;
        return;
      }

      console.log(`User ${roarUid.value} successfully identified as ${userType} user. Routing to home page...`);

      // Stop the polling mechanism.
      clearInterval(userDataCheckInterval);

      // Invalidate all queries to ensure data is fetched freshly after the user document is ready.
      // @TODO: Check if this is actually necessary and if so, if we should only invalidate specific queries.
      queryClient.invalidateQueries();

      // Redirect to the home page.
      router.push({ path: APP_ROUTES.HOME });
    } catch (error) {
      if (error.code !== 'ERR_BAD_REQUEST') {
        throw error;
      }
    }
  };

  /**
   * Starts polling to check for the user type after SSO authentication.
   *
   * @returns {void}
   */
  const startPolling = () => {
    userDataCheckInterval = setInterval(verifyAccountReadiness, POLLING_INTERVAL);
  };

  /**
   * Cleanup function to stop polling when the component is unmounted.
   *
   * @returns {void}
   */
  const stopPolling = () => {
    clearInterval(userDataCheckInterval);
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
