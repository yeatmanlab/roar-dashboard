<template>
  <NavBar
    v-if="displayNavbar"
    :display-name
    :menu-items
    :logo="logoOverride"
    :on-sign-out="signOut"
    :show-account-settings-link
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

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);

const isLevante = import.meta.env.MODE === 'LEVANTE';

let unsubscribe;

const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

const { mutate: signOut } = useSignOutMutation();

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isAdmin, isSuperAdmin } = useUserType(userClaims);

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
  'Vocab',
  'Multichoice',
  'Morphology',
  'Cva',
  'Fluency-ARF',
  'Fluency-ARF-ES',
  'Fluency-CALF',
  'Fluency-CALF-ES',
  'Fluency-Alpaca',
  'Fluency-Alpaca-ES',
  'RAN',
  'Crowding',
  'MEP',
];

const showAccountSettingsLink = computed(() => {
  return !!isAdmin.value || !!isSuperAdmin.value;
});

const displayNavbar = computed(() => {
  if (!route.name) return false;
  return !navbarBlacklist.includes(route.name);
});

const logoOverride = computed(() => {
  return isLevante ? '/LEVANTE/Levante_Logo.png' : null;
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
  if (roarfirekit?.value?.restConfig) init();
});
</script>
