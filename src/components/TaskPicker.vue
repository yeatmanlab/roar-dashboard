<template>
  <div>TaskPicker</div>
  <PvPanel header="Task Picker">
    <template #icons>
      <div class="flex flex-row align-items-center justify-content-end">
        <!-- <small v-if="v$.sequential.$invalid && submitted" class="p-error">Please select one.</small> -->
        <span>Show only named variants</span>
        <PvInputSwitch v-model="namedOnly" class="ml-2" />
      </div>
    </template>
    <div class="w-full flex flex-row gap-2">
      <div class="w-full">
        <div class="flex flex-row">
          <PvInputText v-model="searchTerm" placeholder="Variant name / ID" />
          <small>Type 3 letters to search variant names or IDs</small>
          <PvButton v-if="searchTerm" @click="clearSearch">X</PvButton>
        </div>
        <div v-if="!_isEmpty(searchResults)">
          <PvScrollPanel style="height: 26rem; width: 100%">
            <!-- Draggable Zone 3 -->
            <VueDraggableNext
              v-model="searchResults"
              :reorderable-columns="true"
              :group="{ name: 'variants', pull: 'clone', put: false }"
              :sort="false"
            >
              <transition-group>
                <div v-for="element in searchResults" :key="element.id">
                  <VariantCard :variant="element" />
                </div>
              </transition-group>
            </VueDraggableNext>
          </PvScrollPanel>
        </div>
        <div v-if="_isEmpty(searchResults)">
          <PvDropdown
            v-model="currentTask"
            :options="taskOptions"
            option-label="label"
            option-value="value"
            class="w-full mt-1"
          />
          <PvScrollPanel style="height: 26rem; width: 100%">
            <div v-if="!currentVariants.length">
              No variants to show. Make sure 'Show only named variants' is unchecked to view all.
              <span class="text-link" @click="namedOnly = false">View all</span>
            </div>
            <!-- Draggable Zone 1 -->
            <VueDraggableNext
              v-model="currentVariants"
              :reorderable-columns="true"
              :group="{ name: 'variants', pull: 'clone', put: false }"
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
        <div v-else>You're searching for {{ searchTerm }}</div>
      </div>
      <div class="w-full xl:w-6 lg:w-6">
        <PvScrollPanel style="height: 32rem; width: 100%; overflow-y: auto">
          <!-- Draggable Zone 2 -->
          <VueDraggableNext
            v-model="selectedVariants"
            :group="{
              name: 'variants',
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
import { ref, computed, watch } from 'vue';
import _startCase from 'lodash/startCase';
import _find from 'lodash/find';
import _filter from 'lodash/filter';
import _findIndex from 'lodash/findIndex';
import _debounce from 'lodash/debounce';
import _toLower from 'lodash/toLower';
import _isEmpty from 'lodash/isEmpty';
import { VueDraggableNext } from 'vue-draggable-next';
import VariantCard from './VariantCard.vue';

const props = defineProps({
  allVariants: {
    type: Object,
    required: true,
  },
  setVariants: {
    type: Function,
    required: true,
  },
});

const taskOptions = computed(() => {
  return Object.entries(props.allVariants).map((entry) => {
    const key = entry[0];
    const value = entry[1];
    return {
      label: value[0].task.name ?? key,
      value: key,
    };
  });
});

const updateVariant = (variantId, conditionals) => {
  console.log('updatevariant taskpicker', variantId, conditionals);
  // props.selectedVariant[]
};

const selectedVariants = ref([]);
const namedOnly = ref(true);

const currentTask = ref(Object.keys(props.allVariants)[0]);

const currentVariants = computed(() => {
  if (namedOnly.value) {
    return _filter(props.allVariants[currentTask.value], (variant) => variant.variant.name);
  }
  return props.allVariants[currentTask.value];
});

// Search handlers
const searchTerm = ref('');

const searchResults = ref([]);

const searchCards = async (term) => {
  Object.entries(props.allVariants).forEach(([taskId, variants]) => {
    const matchingVariants = _filter(variants, (variant) => {
      if (_toLower(variant.variant.name).includes(_toLower(term)) || _toLower(variant.id).includes(_toLower(term)))
        return true;
      else return false;
    });
    searchResults.value.push(...matchingVariants);
  });
};

function clearSearch() {
  searchTerm.value = '';
  searchResults.value = [];
}

const debounceSearch = _debounce(searchCards, 250);

watch(searchTerm, (term) => {
  if (term.length >= 3) {
    debounceSearch(term);
  } else {
    searchResults.value = [];
  }
});

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

.variant-selector {
  width: 50%;
}

.selected-container {
  width: 100%;
  border: 1px solid var(--surface-d);
}

.text-link {
  cursor: pointer;
  color: var(--text-color-secondary);
  font-weight: bold;
  text-decoration: underline;
}
</style>
