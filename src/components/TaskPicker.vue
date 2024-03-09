<template>
  <div>TaskPicker</div>
  <div class="w-full flex flex-row">
    <PvTabView class="variant-selector">
      <PvTabPanel v-for="(value, key) in tasks" :key="key" :header="key" data-cy="tab-panel-org-header">
        <div v-for="(variant, index) in value" :key="index">
          <VariantCard :variant="variant" />
        </div>
      </PvTabPanel>
    </PvTabView>
    <div>Selected items go here</div>
  </div>
</template>
<script setup>
import VariantCard from './VariantCard.vue';

const props = defineProps({
  tasks: {
    type: Object,
    required: true,
  },
});
</script>
<style lang="scss">
.parent-container {
  width: 100vw;
}
.variant-selector {
  width: 50%;
}
</style>
