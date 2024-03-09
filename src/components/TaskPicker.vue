<template>
  <div>TaskPicker</div>
  <PvPanel header="Task Picker" style="">
    <div class="w-full flex flex-row">
      <!-- <PvTabView @tab-change="updateCurrentTab" class="variant-selector">
        <PvTabPanel v-for="(value, key) in tasks" :key="key" :header="key" data-cy="tab-panel-org-header">
          <PvScrollPanel style="height: 26rem; width: 100%">
            <div v-for="variant in value">
              <VariantCard :variant="variant" />
            </div>
          </PvScrollPanel>
        </PvTabPanel>
      </PvTabView> -->
      <div class="variant-selector">
        <PvDropdown
          v-model="currentTask"
          :options="taskOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
        <PvScrollPanel style="height: 26rem; width: 100%">
          <draggable
            v-model="currentVariants"
            group="variant"
            @start="drag = true"
            @end="drag = false"
            item-key="id"
            class="w-full h-full"
            style="background-color: aquamarine"
          >
            <template #item="{ element }">
              <div>{{ element }}</div>
            </template>
          </draggable>
          <!-- <div v-for="variant in currentVariants">
            <VariantCard :variant="variant" />
          </div> -->
        </PvScrollPanel>
      </div>
      <div class="selected-container">
        <div class="w-full" style="background-color: #fafafa; border: 1px solid #e5e7eb; height: 4rem">
          Selected Content
        </div>
        <PvScrollPanel class="w-full h-full">
          <draggable
            v-model="selectedVariants"
            group="variant"
            @start="drag = true"
            @end="drag = false"
            item-key="id"
            class="w-full h-full"
            style="background-color: aquamarine"
          >
            <template #item="{ element }">
              <div>{{ element }}</div>
            </template>
          </draggable>
        </PvScrollPanel>
      </div>
    </div>
  </PvPanel>
</template>
<script setup>
import { ref, computed } from 'vue';
import _startCase from 'lodash/startCase';
import draggable from 'vuedraggable';
import VariantCard from './VariantCard.vue';

const props = defineProps({
  tasks: {
    type: Object,
    required: true,
  },
});

const drag = ref(false);

const taskOptions = computed(() => {
  return Object.keys(props.tasks).map((key) => {
    return {
      label: _startCase(key),
      value: key,
    };
  });
});

const currentTask = ref(Object.keys(props.tasks)[0]);

const currentVariants = computed(() => {
  return props.tasks[currentTask.value];
});
const selectedVariants = ref([]);
</script>
<style lang="scss">
.task-tab {
  height: 100%;
  overflow: auto;
}
.variant-selector {
  width: 50%;
}
.selected-container {
  width: 100%;
  border: 1px solid var(--surface-d);
}
</style>
