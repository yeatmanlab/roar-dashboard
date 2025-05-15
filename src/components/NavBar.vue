<template>
  <header id="site-header" class="navbar-container">
    <nav class="flex flex-row align-items-center justify-content-between w-full">
      <div id="navBarRightEnd" class="flex flex-row align-items-center justify-content-start w-full gap-1">
        <div class="flex align-items-center justify-content-center w-full">
          <PvMenubar :model="computedItems" class="w-full">
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
              <router-link :to="{ name: 'Debug' }" class="mr-3">
                <PvButton
                  icon="pi pi-bug"
                  class="p-button-text p-button-rounded"
                  aria-label="Debug"
                  label="Debug"
                />
              </router-link>
              <UserActions :isBasicView="computedIsBasicView" />
            </template>
          </PvMenubar>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvImage from 'primevue/image';
import PvMenubar from 'primevue/menubar';
import { useAuthStore } from '@/store/auth';
import { getNavbarActions } from '@/router/navbarActions';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { APP_ROUTES } from '@/constants/routes';
import Badge from 'primevue/badge';
import UserActions from './UserActions.vue';
import useUserType from '@/composables/useUserType';


const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);
const menu = ref();
const screenWidth = ref(window.innerWidth);
let unsubscribe;

const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

const handleResize = () => {
  screenWidth.value = window.innerWidth;
};

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const computedItems = computed(() => {
  const items = [];
  // TO DO: REMOVE USERS AFTER NAMING 3 TICKET IS COMPLETED

  // Groups only has one associated page and therefore is not nested within items
  const groupsAction = rawActions.value.find((action) => action.category === 'Groups');
  if (groupsAction) {
    items.push({
      label: groupsAction.title,
      icon: groupsAction.icon,
      command: () => {
        router.push(groupsAction.buttonLink);
      },
    });
  }

  const headers = ['Users', 'Assignments'];
  for (const header of headers) {
    const headerItems = rawActions.value
      .filter((action) => action.category === header)
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
        label: header,
        items: headerItems,
      });
    }
  }
  return items;
});

const { isAdmin, isSuperAdmin } = useUserType(userClaims);

const computedIsBasicView = computed(() => {
  if (!userClaims.value) {
    return false; 
  }
  return !isSuperAdmin.value && !isAdmin.value  
});

const isAtHome = computed(() => {
  return router.currentRoute.value.fullPath === '/';
});

const rawActions = computed(() => {
  return getNavbarActions({
    isSuperAdmin: isSuperAdmin.value,
    isAdmin: authStore.isUserAdmin,
    includeHomeLink: !isAtHome.value,
  });
});

const toggleMenu = (event) => {
  menu.value.toggle(event);
};
</script>

<style scoped>
nav {
  min-width: 100%;
}

</style>
