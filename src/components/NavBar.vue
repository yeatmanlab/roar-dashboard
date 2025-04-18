<template>
  <header id="site-header" class="navbar-container">
    <nav class="flex flex-row align-items-center justify-content-between w-full">
      <div id="navBarRightEnd" class="flex flex-row align-items-center justify-content-start w-full gap-1">
        <div class="flex align-items-center justify-content-center w-full">
          <PvMenubar :model="computedItems" class="w-full" ref="menu">
            <template #start>
              <router-link :to="{ path: APP_ROUTES.HOME }">
                <div class="navbar-logo mx-3">
                  <PvImage src="/LEVANTE/Levante_Logo.png" alt="LEVANTE Logo" width="200" />
                </div>
              </router-link>
            </template>

            <template #buttonicon>
              <PvButton
                icon="pi pi-bars mr-2"
                class="bg-primary text-white p-2 mr-2 border-none border-round hover:bg-red-900"
                label="Menu"
                @click="toggleMenu"
              />
            </template>

            <template #item="{ item, props, hasSubmenu, root }">
              <a class="flex items-center" v-bind="props.action">
                <i v-if="item.icon" :class="['mr-2', item.icon]"></i>
                <span>{{ item.label }}</span>
                <Badge v-if="item.badge" :class="[item.badgeClass, { 'ml-auto': !root, 'ml-2': root }]" :value="item.badge" />
                <i v-if="hasSubmenu" :class="['pi ml-auto', { 'pi-angle-down': root, 'pi-angle-right': !root }]"></i>
              </a>
            </template>

            <template #end>
              <UserActions :isBasicView="computedIsBasicView"  :name="userDisplayName" />
            </template>
          </PvMenubar>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';
import { useRouter, type Router, type RouteLocationNormalizedLoaded } from 'vue-router';
import { storeToRefs } from 'pinia';
import type { SubscriptionCallbackMutation } from 'pinia';
import PvButton from 'primevue/button';
import PvImage from 'primevue/image';
import PvMenubar from 'primevue/menubar';
// @ts-ignore TODO: Convert store/auth to TS
import { useAuthStore, type AuthState } from '@/store/auth';
import { getNavbarActions, type NavbarAction } from '@/router/navbarActions';
// @ts-ignore TODO: Convert composables/queries/useUserClaimsQuery to TS
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { APP_ROUTES } from '@/constants/routes';
import Badge from 'primevue/badge';
// @ts-ignore TODO: Convert UserActions.vue to TS
import UserActions from './UserActions.vue';
import useUserType from '@/composables/useUserType';
import type { MenuItem } from 'primevue/menuitem';


const router: Router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized: Ref<boolean> = ref(false);
const screenWidth: Ref<number> = ref(window.innerWidth);
let unsubscribe: (() => void) | undefined;

const init = (): void => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe((mutation: SubscriptionCallbackMutation<AuthState>, state: AuthState): void => {
  if (state.roarfirekit.restConfig) init();
});

const handleResize = (): void => {
  screenWidth.value = window.innerWidth;
};

onMounted((): void => {
  if (roarfirekit.value.restConfig) init();
  window.addEventListener('resize', handleResize);
});

onUnmounted((): void => {
  window.removeEventListener('resize', handleResize);
  if (unsubscribe) unsubscribe();
});

// Assuming useUserClaimsQuery returns an object with data and isLoading refs
const { isLoading: isLoadingClaims, data: userClaims }: { isLoading: Ref<boolean>; data: Ref<any> } = useUserClaimsQuery({
  enabled: initialized,
});

const computedItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [];
  // TO DO: REMOVE USERS AFTER NAMING 3 TICKET IS COMPLETED
  const headers: string[] = ['Assignments', 'Users'];
  for (const header of headers) {
    const headerItems: MenuItem[] = rawActions.value
      .filter((action: NavbarAction) => action.category === header)
      .map((action: NavbarAction): MenuItem => {
        const menuItem: MenuItem = {
          label: action.title,
          icon: action.icon,
          command: () => {
            if (action.buttonLink) {
              router.push(action.buttonLink);
            }
          },
        };
        if (action.title === 'Sync Passwords') { // Example of conditional modification
          menuItem.badge = 'Temporary';
          menuItem.pt = { // Use pt for badge styling if badgeClass is not standard MenuItem prop
            badge: { class: 'bg-yellow-300' }
          };
        }
        return menuItem;
      });

    if (headerItems.length > 0) {
      items.push({
        label: header,
        items: headerItems,
      });
    }
  }
  // Audience only has one associated page and therefore is not nested within items
  const audienceAction: NavbarAction | undefined = rawActions.value.find((action: NavbarAction) => action.category === 'Audience');
  if (audienceAction) {
    items.push({
      label: audienceAction.title,
      icon: audienceAction.icon,
      command: () => {
        if (audienceAction.buttonLink) {
          router.push(audienceAction.buttonLink);
        }
      },
    });
  }

  return items;
});

const userDisplayName = computed<string>(() => {
  // Note: Logic changed slightly to reflect isLoading is boolean
  if (isLoadingClaims.value || !authStore?.userData) {
    return '';
  } else {
    let email: string | undefined = authStore.userData.email;
    if (email && email.includes('@') && email.split('@')[1] === 'roar-auth.com') {
      email = email.split('@')[0];
    }
    const displayName: string | undefined = authStore.userData.displayName;
    const username: string | undefined = authStore.userData.username;
    const firstName: string | undefined = authStore.userData.name?.first;
    const userType: string = isAdmin.value ? 'Admin' : 'User'; // isAdmin is derived from useUserType
    // Added more checks for null/undefined
    return ` ${firstName || displayName || username || email || userType}`.trim();
  }
});

const { isAdmin, isSuperAdmin } = useUserType(userClaims);

const computedIsBasicView = computed<boolean>(() => {
  if (!userClaims.value) {
    return false; // Default to false if claims are not loaded
  }
  // Ensure boolean values from useUserType are used directly
  return !isSuperAdmin.value && !isAdmin.value;
});

const isAtHome = computed<boolean>(() => {
  const currentRoute: RouteLocationNormalizedLoaded = router.currentRoute.value;
  return currentRoute.path === '/'; // Check path directly
});

const rawActions = computed<NavbarAction[]>(() => {
  // Assuming getNavbarActions expects boolean values
  return getNavbarActions({
    isSuperAdmin: isSuperAdmin.value ?? false,
    isAdmin: isAdmin.value ?? false, // Use the destructured isAdmin value
  });
});

const toggleMenu = (): void => {
  // PvMenubar seems to handle toggle internally even with #buttonicon slot
  // No need for manual state toggle like isMenuOpen.value = !isMenuOpen.value;
};
</script>

<style scoped>
nav {
  min-width: 100%;
}

</style>
