<template>
  <PvButton>
    <i class="pi pi-info-circle" />
  </PvButton>
  <PvDialog
    v-model:visible="visible"
    :draggable="false"
    modal
    header="View Variants"
    :style="{ width: '65vw' }"
    :breakpoints="{ '1199px': '85vw', '575px': '95vw' }"
  >
    Variants will be here
  </PvDialog>
</template>
<script setup>
import { ref } from 'vue';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';

const visible = ref(false);
defineProps({
  variants: {
    type: Array,
    required: true,
  },
});
</script>
