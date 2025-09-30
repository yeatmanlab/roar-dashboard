<template>
  <div>
    <div v-if="isLoadingPermissions" class="flex align-items-center justify-content-center p-4">
      <LevanteSpinner />
      <span class="ml-2">{{ $t('permissions.loading') || 'Loading permissions...' }}</span>
    </div>

    <!-- Access denied state -->
    <div v-else-if="shouldCheckPermissions && !hasPermission" class="flex flex-column align-items-center justify-content-center p-4 text-center">
      <i class="pi pi-lock text-4xl text-red-500 mb-3"></i>
      <h3 class="text-red-500 mb-2">{{ $t('permissions.accessDenied') || 'Access denied' }}</h3>
      <p class="text-gray-600 mb-3">{{ $t('permissions.insufficientPermissions') || 'Insufficient permissions' }}</p>
      <PvButton
        v-if="fallbackRoute"
        class="p-button-outlined"
        @click="handleFallbackAction"
      >
        {{ $t('permissions.goBack') || 'Go back' }}
      </PvButton>
    </div>

    <!-- Render children if permissions are disabled or access is granted -->
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { usePermissions } from '@/composables/usePermissions';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import PvButton from 'primevue/button';
import type { Resource, Action, Role } from '@levante-framework/permissions-core';

interface Props {
  resource?: Resource;
  action?: Action;
  requireRole?: Role;
  fallbackRoute?: string;
}

const props = withDefaults(defineProps<Props>(), {
  resource: undefined,
  action: undefined,
  requireRole: undefined,
  fallbackRoute: undefined,
});

const router = useRouter();
const authStore = useAuthStore();
const { shouldUsePermissions: shouldUsePermissionsRef } = storeToRefs(authStore);
const { can, hasRole, permissionsLoaded } = usePermissions();

const shouldUsePermissions = computed(() => Boolean(shouldUsePermissionsRef.value));

const isLoadingPermissions = computed(() => {
  return shouldUsePermissions.value && !permissionsLoaded.value;
});

const shouldCheckPermissions = computed(() => {
  return shouldUsePermissions.value && (props.resource || props.requireRole);
});

const hasPermission = computed(() => {
  if (!shouldCheckPermissions.value) {
    return true;
  }

  if (props.resource && props.action) {
    console.log('props.resource: ', props.resource);
    console.log('props.action: ', props.action);
    console.log('permissionsLoaded: ', permissionsLoaded.value);
    console.log('hasPermission: ', can(props.resource, props.action));
    return can(props.resource, props.action);
  }

  if (props.requireRole) {
    return hasRole(props.requireRole);
  }

  return false;
});

// Handle fallback action (e.g., navigate to a safe route)
const handleFallbackAction = () => {
  if (props.fallbackRoute) {
    router.push({ name: props.fallbackRoute });
  }
};
</script>

<style lang="scss" scoped>

</style>
