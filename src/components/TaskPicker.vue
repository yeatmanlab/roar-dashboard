<template>
  <div>TaskPicker</div>
  <PvPanel header="Task Picker">
    <div class="w-full flex flex-row">
      <div class="variant-selector">
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
            :group="{
              name: 'people',
              pull: true,
              put: function (to, from) {
                console.log(to, from);
                return true;
              },
              animation: 100,
            }"
            :sort="true"
            class="w-full h-full overflow-auto"
          >
            <transition-group>
              <div v-for="element in selectedVariants" :key="element.id" :id="element.id">
                <VariantCard
                  :variant="element"
                  has-controls
                  @remove="removeCard"
                  @moveUp="moveCardUp"
                  @moveDown="moveCardDown"
                />
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
import _find from 'lodash/find';
import _findIndex from 'lodash/findIndex';
import { VueDraggableNext } from 'vue-draggable-next';
import VariantCard from './VariantCard.vue';

const props = defineProps({
  tasks: {
    type: Object,
    required: true,
  },
});

const taskOptions = computed(() => {
  return Object.entries(props.tasks).map((entry) => {
    const key = entry[0];
    const value = entry[1];
    return {
      label: value[0].task.name ?? key,
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
const moveCardUp = (variant) => {
  const index = _findIndex(selectedVariants.value, (currentVariant) => currentVariant.id === variant.id);
  if (index === 0) return;
  const item = selectedVariants.value[index];
  selectedVariants.value.splice(index, 1);
  selectedVariants.value.splice(index - 1, 0, item);
};
const moveCardDown = (variant) => {
  const index = _findIndex(selectedVariants.value, (currentVariant) => currentVariant.id === variant.id);
  if (index === selectedVariants.value.length) return;
  const item = selectedVariants.value[index];
  selectedVariants.value.splice(index, 1);
  selectedVariants.value.splice(index + 1, 0, item);
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
