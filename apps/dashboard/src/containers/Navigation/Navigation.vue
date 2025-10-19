<template>
  <NavBar
    v-if="displayNavbar"
    :display-name="displayName"
    :menu-items="menuItems"
    :on-sign-out="signOut"
    :show-account-settings-link="showAccountSettingsLink"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import { getSidebarActions } from '@/router/sidebarActions';
import NavBar from '@/components/NavBar';
import { usePermissions } from '@/composables/usePermissions';
import useIsNycpsUser from '@/composables/useIsNycpsUser';
const { userCan, Permissions } = usePermissions();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { roarfirekit, userData } = storeToRefs(authStore);

const initialized = ref(false);

let unsubscribe;

const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) init();
});

const { mutate: signOut } = useSignOutMutation();

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isAdmin, isSuperAdmin, isLaunchAdmin } = useUserType(userClaims);
const { isNycpsUser } = useIsNycpsUser(userData);

// @TODO: Move the navbar blacklist to route meta definitions.
const navbarBlacklist = [
  'SignIn',
  'Register',
  'Maintenance',
  'PlayApp',
  'SWR',
  'SWR-ES',
  'SRE',
  'SRE-ES',
  'PA',
  'PA-ES',
  'Letter',
  'Letter-ES',
  'Phonics',
  'Vocab',
  'Multichoice',
  'Morphology',
  'Cva',
  'Read Aloud',
  'ROAM-ARF',
  'ROAM-ARF-ES',
  'ROAM-CALF',
  'ROAM-CALF-ES',
  'ROAM-Alpaca',
  'ROAM-Alpaca-ES',
  'RAN',
  'Crowding',
  'MEP',
  'Launch SWR',
  'Launch SWR-ES',
  'Launch SRE',
  'Launch SRE-ES',
  'Launch PA',
  'Launch PA-ES',
  'Launch Read Aloud',
  'Launch Letter',
  'Launch Letter-ES',
  'Launch Phonics',
  'Launch Vocab',
  'Launch Multichoice',
  'Launch Morphology',
  'Launch Cva',
  'Launch Fluency-ARF',
  'Launch Fluency-ARF-ES',
  'Launch Fluency-CALF',
  'Launch Fluency-CALF-ES',
  'Launch Fluency-Alpaca',
  'Launch Fluency-Alpaca-ES',
  'Launch RAN',
  'Launch Crowding',
  'Launch MEP',
  'AuthNycps',
  'InitiateAuthNycps',
];

const showAccountSettingsLink = computed(() => {
  // Hide button while loading to prevent button from popping in and out
  if (!userData.value) return false;
  return userCan(Permissions.Profile.READ) && !isNycpsUser.value;
});

const displayNavbar = computed(() => {
  if (!route.name) return false;
  return !navbarBlacklist.includes(route.name);
});

const displayName = computed(() => {
  if (!userClaims) return;

  let email = authStore?.userData?.email;

  if (email && email.split('@')[1] === 'roar-auth.com') {
    email = email.split('@')[0];
  }

  const displayName = authStore?.userData?.displayName;
  const username = authStore?.userData?.username;
  const firstName = authStore?.userData?.name?.first;
  const userType = isAdmin.value ? 'Admin' : 'User';

  return `${firstName || displayName || username || email || userType}`;
});

const defaultMenuActions = computed(() => {
  return getSidebarActions({
    isSuperAdmin: isSuperAdmin.value,
    isAdmin: isSuperAdmin.value || isAdmin.value,
    isLaunchAdmin: isLaunchAdmin.value,
  });
});

const menuItems = computed(() => {
  const items = [];
  const menuEntries = ['Administrations', 'Organizations', 'Users'];

  for (const entry of menuEntries) {
    const headerItems = defaultMenuActions.value
      .filter((action) => action.category === entry)
      .map((action) => {
        return {
          label: action.title,
          icon: action.icon,
          command: () => {
            router.push(action.buttonLink);
          },
        };
      });

    if (headerItems.length > 0) {
      items.push({
        label: entry,
        items: headerItems,
      });
    }
  }

  return items;
});

onMounted(() => {
  if (roarfirekit?.value?.restConfig?.()) init();
});
</script>
