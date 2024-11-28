<template>
  <header id="site-header" class="navbar-container">
    <nav class="flex flex-row align-items-center justify-content-between w-full">
      <div id="navBarRightEnd" class="flex flex-row align-items-center justify-content-start w-full gap-1">
        <div class="flex align-items-center justify-content-center w-full">
          <PvMenubar :model="menuItems" class="w-full">
            <template #start>
              <router-link :to="{ path: APP_ROUTES.HOME }" data-cy="navbar__logo">
                <div class="navbar-logo mx-3">
                  <ROARLogo v-if="!logo" />
                  <PvImage v-else :src="logo" alt="Logo" width="200" height="auto" />
                </div>
              </router-link>
            </template>

            <template #menubuttonicon>
              <PvButton
                icon="pi pi-bars mr-2"
                class="bg-primary text-white p-2 mr-2 border-none border-round hover:bg-red-900"
                label="Menu"
                @click="toggleMenu"
              />
            </template>

            <template #end>
              <div class="flex gap-2 align-items-center justify-content-center mr-3">
                <div v-if="isWideScreen" class="nav-user-wrapper flex align-items-center gap-2 bg-gray-100">
                  <div class="text-lg font-bold text-gray-600" data-cy="navbar__display-name">
                    {{ $t('navBar.greeting') }}, {{ displayName }}!
                  </div>

                  <PvButton
                    text
                    data-cy="navbar__signout-btn-desktop"
                    class="no-underline h-2 p-1 m-0 text-primary border-none border-round h-2rem text-sm hover:bg-red-900 hover:text-white"
                    @click="handleSignOut"
                    >{{ $t('navBar.signOut') }}
                  </PvButton>
                </div>

                <PvButton
                  v-else
                  data-cy="navbar__signout-btn-mobile"
                  class="no-underline m-0 bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
                  @click="handleSignOut"
                >
                  {{ $t('navBar.signOut') }}
                </PvButton>

                <div v-if="showAccountSettingsLink" class="nav-user-wrapper bg-gray-100">
                  <router-link :to="{ path: APP_ROUTES.ACCOUNT_PROFILE }" data-cy="navbar__account-settings-btn">
                    <button
                      class="no-underline p-1 m-0 text-primary border-none border-round cursor-pointer h-2rem w-2rem text-sm hover:bg-red-900 hover:text-white"
                    >
                      <i class="pi pi-cog"></i></button
                  ></router-link>
                </div>

                <div class="my-2">
                  <LanguageSelector />
                </div>
              </div>
            </template>
          </PvMenubar>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import PvButton from 'primevue/button';
import PvImage from 'primevue/image';
import PvMenubar from 'primevue/menubar';
import LanguageSelector from '@/components/LanguageSelector.vue';
import { APP_ROUTES } from '@/constants/routes';
import ROARLogo from '@/assets/RoarLogo.vue';

// Define props
const props = defineProps({
  displayName: {
    type: String,
    required: true,
  },
  logo: {
    type: [String, Object],
    default: null,
  },
  menuItems: {
    type: Array,
    required: true,
  },
  onSignOut: {
    type: Function,
    required: true,
  },
  showAccountSettingsLink: {
    type: Boolean,
    default: true,
  },
});

const menu = ref();
const screenWidth = ref(window.innerWidth);

// @TODO: Replace screen-size handlers with Tailwind/CSS media queries. Currently not possible due to an outdated
// PrimeVue and Tailwind version. If we cannot update PrimeVue/Tailwind, we should throttle the resize events.
const isWideScreen = computed(() => {
  return screenWidth.value > 728;
});

const handleResize = () => {
  screenWidth.value = window.innerWidth;
};

const handleSignOut = () => {
  props.onSignOut();
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const toggleMenu = (event) => {
  menu.value.toggle(event);
};
</script>

<style scoped>
nav {
  min-width: 100%;
}

.nav-user-wrapper {
  display: flex;
  align-items: center;
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.3rem;
  padding: 0.5rem 0.8rem;
}
</style>
