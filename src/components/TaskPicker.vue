<template>
  <div>TaskPicker</div>
  <PvPanel header="Task Picker">
    <template #icons>
      <div class="flex flex-row align-items-center justify-content-end w-full xl:w-6 lg:w-6">
        <!-- <small v-if="v$.sequential.$invalid && submitted" class="p-error">Please select one.</small> -->
        <span>Show only named variants</span>
        <PvInputSwitch v-model="namedOnly" class="ml-2" />
        <!-- <button @click="tasksPaneOpen = !tasksPaneOpen">toggle pane</button> -->
      </div>
    </template>
    <div class="w-full flex flex-row gap-2">
      <div v-if="tasksPaneOpen" class="w-6">
        <div class="flex flex-row mb-2">
          <div class="flex flex-column flex-grow-1 p-input-icon-left">
            <i class="pi pi-search" />
            <PvInputText v-model="searchTerm" placeholder="Variant name / ID" />
          </div>
          <PvButton v-if="searchTerm" @click="clearSearch" style="margin-right: 0">
            <i class="pi pi-times" />
          </PvButton>
        </div>
        <div v-if="searchTerm.length >= 3">
          <div v-if="isSearching">
            <span>Searching...</span>
          </div>
          <div v-else-if="_isEmpty(searchResults)">
            <span>No search results for {{ searchTerm }}</span>
          </div>
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
        <div v-if="searchTerm.length < 3">
          <PvDropdown
            v-model="currentTask"
            :options="taskOptions"
            option-label="label"
            option-value="value"
            class="w-full mb-2"
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
                  <VariantCard :variant="element" :update-variant="updateVariant" />
                </div>
              </transition-group>
            </VueDraggableNext>
          </PvScrollPanel>
        </div>
      </div>
      <div v-else class="w-1 bg-gray-400">
        <i class="pi pi-angle-double-right" />
      </div>
      <div class="divider"></div>
      <div class="w-full xl:w-6 lg:w-6">
        <div class="mb-2">Selected Variants</div>
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
                  :update-variant="updateVariant"
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

const updateVariant = (variantId, conditions) => {
  const updatedVariants = selectedVariants.value.map((variant) => {
    if (variant.id === variantId) {
      return { ...variant, variant: { ...variant.variant, conditions: conditions } };
    } else {
      return variant;
    }
  });
  selectedVariants.value = updatedVariants;
  return;
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

// Pane handlers
const tasksPaneOpen = ref(true);

// Search handlers
const searchTerm = ref('');
const searchResults = ref([]);
const isSearching = ref(false);

const searchCards = (term) => {
  isSearching.value = true;
  searchResults.value = [];
  Object.entries(props.allVariants).forEach(([taskId, variants]) => {
    const matchingVariants = _filter(variants, (variant) => {
      if (_toLower(variant.variant.name).includes(_toLower(term)) || _toLower(variant.id).includes(_toLower(term)))
        return true;
      else return false;
    });
    searchResults.value.push(...matchingVariants);
  });
  isSearching.value = false;
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
.divider {
  min-height: 100%;
  max-width: 0;
  border-left: 1px solid var(--surface-d);
}
</style>
