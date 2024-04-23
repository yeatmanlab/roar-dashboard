<template>
  <div>
    <router-link :to="{ name: col.routeName, params: routeParams }">
      <PvButton
        severity="secondary"
        text
        :label="col.routeLabel"
        :aria-label="col.routeTooltip"
        :icon="col.routeIcon"
        size="small"
      />
    </router-link>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue';
const props = defineProps({
  colData: {
    type: Object,
    default: () => ({}),
    required: false,
  },
  col: {
    type: Object,
    default: () => ({}),
    required: false,
  },
});

const routeParams = computed(() => {
  if (props.colData.routeParams) {
    return props.colData.routeParams;
  } else {
    return {
      administrationId: props?.col.administrationId,
      orgId: props.col?.orgId,
      orgType: props.col?.orgType,
      userId: props.colData?.user?.userId,
    };
  }
});
</script>
