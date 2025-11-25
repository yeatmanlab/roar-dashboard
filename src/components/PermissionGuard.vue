<template>
  <div v-if="isLoadingPermissions" class="flex align-items-center justify-content-center p-4">
    <LevanteSpinner />
    <span class="ml-2">{{ $t('permissions.loading') || 'Loading permissions...' }}</span>
  </div>
  <slot v-else-if="hasPermission" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { usePermissions } from '@/composables/usePermissions';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import type { Resource, Action, Role, GroupSubResource, AdminSubResource } from '@levante-framework/permissions-core';

interface Props {
  resource?: Resource;
  subResource?: GroupSubResource | AdminSubResource;
  action?: Action;
  requiredRole?: Role;
  fallbackRoute?: string;
}

const props = withDefaults(defineProps<Props>(), {
  resource: undefined,
  subResource: undefined,
  action: undefined,
  requiredRole: undefined,
  fallbackRoute: undefined,
});

const authStore = useAuthStore();
const { shouldUsePermissions: shouldUsePermissionsRef } = storeToRefs(authStore);
const { can, hasRole, permissionsLoaded } = usePermissions();

const shouldUsePermissions = computed(() => Boolean(shouldUsePermissionsRef.value));

const isLoadingPermissions = computed(() => {
  return shouldUsePermissions.value && !permissionsLoaded.value;
});

const shouldCheckPermissions = computed(() => {
  return shouldUsePermissions.value && (props.resource || props.subResource || props.requiredRole);
});

const hasPermission = computed(() => {
  if (!shouldCheckPermissions.value) {
    return true;
  }

  if (props.resource && props.action) {
    return can(props.resource, props.action, props.subResource);
  }

  if (props.requiredRole) {
    return hasRole(props.requiredRole);
  }

  return false;
});
</script>

<style lang="scss" scoped>

</style>
