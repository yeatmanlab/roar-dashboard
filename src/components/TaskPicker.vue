<template>
  <div>TaskPicker</div>
  <PvPanel header="Task Picker" style="">
    <div class="w-full flex flex-column xl:flex-row lg:flex-row">
      <div class="w-full xl:w-6 lg:w-6">
        <PvDropdown
          v-model="currentTask"
          :options="taskOptions"
          option-label="label"
          option-value="value"
          class="w-full mt-1"
        />
        <PvScrollPanel style="height: 26rem; width: 100%">
          <!-- Draggable Zone 1 -->
          <VueDraggableNext
            v-model="currentVariants"
            :reorderable-columns="true"
            :group="{ name: 'people', pull: 'clone', put: false }"
            :sort="false"
          >
            <transition-group>
              <div v-for="element in currentVariants" :key="element.id">
                <VariantCard :variant="element" />
              </div>
            </transition-group>
          </VueDraggableNext>
        </PvScrollPanel>
      </div>
      <div class="w-full xl:w-6 lg:w-6">
        <PvScrollPanel style="height: 32rem; width: 100%; overflow-y: auto">
          <!-- Draggable Zone 2 -->
          <VueDraggableNext
            v-model="selectedVariants"
            :group="{ name: 'people', pull: true, put: true }"
            :sort="true"
            class="w-full h-full overflow-auto"
          >
            <transition-group>
              <div v-for="element in selectedVariants" :key="element.id">
                <VariantCard :variant="element" has-controls @remove="removeCard" />
              </div>
            </transition-group>
          </VueDraggableNext>
        </PvScrollPanel>
      </div>
    </div>
  </PvPanel>
</template>
<script setup>
import { ref, computed } from 'vue';
import _startCase from 'lodash/startCase';
import { VueDraggableNext } from 'vue-draggable-next';
import VariantCard from './VariantCard.vue';

const props = defineProps({
  tasks: {
    type: Object,
    required: true,
  },
});

const taskOptions = computed(() => {
  return Object.keys(props.tasks).map((key) => {
    return {
      label: key,
      value: key,
    };
  });
});

const currentTask = ref(Object.keys(props.tasks)[0]);

const currentVariants = computed(() => {
  return props.tasks[currentTask.value];
});
const selectedVariants = ref([]);

// Card event handlers
const removeCard = (variant) => {
  selectedVariants.value = selectedVariants.value.filter((selectedVariant) => selectedVariant.id !== variant.id);
};
</script>
<style lang="scss">
.task-tab {
  height: 100%;
  overflow: auto;
}

.selected-container {
  width: 100%;
  border: 1px solid var(--surface-d);
}
</style>
