<template>
  <PvPanel>
    <template #header>
      <div class="flex align-items-center font-bold">
        Select Tasks <span class='required-asterisk text-red-500 ml-1'>*</span>
      </div>
    </template>
    <div class="w-full flex flex-column lg:flex-row gap-2">
      <div v-if="tasksPaneOpen" class="w-full lg:w-6">
        <div class="flex flex-row mb-2">
          <div class="flex flex-column flex-grow-1 p-input-icon-left">
            <PvIconField class="w-full">
              <PvInputIcon class="pi pi-search"></PvInputIcon>
              <PvInputText
                v-model="searchTerm"
                class="w-full"
                placeholder="Variant name, ID, or Task ID"
                data-cy="input-variant-name"
              />
            </PvIconField>
          </div>
          <PvButton
            v-if="searchTerm"
            class="bg-primary text-white border-none border-round pl-3 pr-3 hover:bg-red-900"
            style="margin-right: 0"
            @click="clearSearch"
          >
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
          <PvScrollPanel style="height: 31rem; width: 100%; overflow-y: auto">
            <!-- Draggable Zone 3 -->
            <VueDraggableNext
              v-model="searchResults"
              :reorderable-columns="true"
              :group="{ name: 'variants', pull: 'clone', put: false }"
              :sort="false"
              :move="handleCardMove"
            >
              <transition-group>
                <div
                  v-for="element in searchResults"
                  :id="element.id"
                  :key="element.id"
                  :data-task-id="element.task.id"
                  style="cursor: grab"
                >
                  <VariantCard :variant="element" @select="selectCard" />
                </div>
              </transition-group>
            </VueDraggableNext>
          </PvScrollPanel>
        </div>
        <div v-if="searchTerm.length < 3">
          <PvSelect
            v-model="currentTask"
            :options="taskOptions"
            optionGroupLabel="label"
            optionGroupChildren="items"
            option-label="label"
            option-value="value"
            class="w-full mb-2"
            placeholder="Select TaskID"
          >
            <template #optiongroup="slotProps">
              <div class="flex items-center">
                <div className="select-group-name">{{ slotProps.option.label }}</div>
              </div>
            </template>
          </PvSelect>
          <PvScrollPanel style="height: 27.75rem; width: 100%; overflow-y: auto">
            <div v-if="!currentTask">Select a TaskID to display a list of variants.</div>
            <div v-else-if="!currentVariants.length">
              No variants to show. Make sure 'Show only named variants' is unchecked to view all.
              <span class="text-link" @click="namedOnly = false">View all</span>
            </div>
            <!-- Draggable Zone 1 -->
            <VueDraggableNext
              v-model="currentVariants"
              :reorderable-columns="true"
              :group="{ name: 'variants', pull: 'clone', put: false }"
              :sort="false"
              :move="handleCardMove"
            >
              <transition-group>
                <div
                  v-for="element in currentVariants"
                  :id="element.id"
                  :key="element.id"
                  :data-task-id="element.task.id"
                  style="cursor: grab"
                >
                  <VariantCard :variant="element" :update-variant="updateVariant" @select="selectCard" />
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
      <div class="w-full lg:w-6" data-cy="panel-droppable-zone">
        <div class="panel-title mb-2 text-base">Selected Tasks <span class='required-asterisk text-red-500 ml-1'>*</span></div>
        <PvScrollPanel style="height: 32rem; width: 100%; overflow-y: auto">
          <!-- Draggable Zone 2 -->
          <VueDraggableNext
            v-model="selectedVariants"
            :move="handleCardMove"
            :group="{
              name: 'variants',
              pull: true,
              put: true,
              animation: 100,
            }"
            :sort="true"
            class="w-full h-full overflow-auto"
            @add="handleCardAdd"
          >
            <transition-group>
              <div
                v-for="element in selectedVariants"
                :id="element.id"
                :key="element.id"
                :data-task-id="element.task.id"
                style="cursor: grab"
              >
                <VariantCard
                  :variant="element"
                  has-controls
                  :update-variant="updateVariant"
                  :pre-existing-assessment-info="preExistingAssessmentInfo"
                  @remove="removeCard"
                  @move-up="moveCardUp"
                  @move-down="moveCardDown"
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
import { computed, ref, watch } from 'vue';
import _filter from 'lodash/filter';
import _findIndex from 'lodash/findIndex';
import _debounce from 'lodash/debounce';
import _toLower from 'lodash/toLower';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { VueDraggableNext } from 'vue-draggable-next';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import VariantCard from './VariantCard.vue';
import _cloneDeep from 'lodash/cloneDeep';
import PvIconField from 'primevue/iconfield';
import PvInputIcon from 'primevue/inputicon';


const toast = useToast();

const props = defineProps({
  allVariants: {
    type: Object,
    required: true,
  },
  inputVariants: {
    type: Array,
    default: () => [],
  },
  preExistingAssessmentInfo: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['variants-changed']);

const groupedTasks = {
  "Introduction": ['Instructions'],
  "Language and Literacy": [
    "Vocabulary",
    "Sentence Understanding",
    "Language Sounds",
    "Word Reading",
    "Sentence Reading",
  ],
  "Executive Function": ["Hearts & Flowers", "Same & Different", "Memory"],
  "Math": ["Math"],
  "Reasoning": ["Pattern Matching"],
  "Spatial Cognition": ["Shape Rotation"],
  "Social Cognition": ["Stories"],
  "Attitudes": ["Thoughts & Feelings"]
};

const taskOptions = computed(() => {

  let remainingTasks = new Set(Object.keys(props.allVariants));
  let groupedOptions = Object.entries(groupedTasks).map(([groupName, tasks]) => {
    let groupItems = [];

    tasks.forEach((task) => {
      const taskKey = Object.keys(props.allVariants).find(
        (entry) => {
          return props.allVariants[entry][0].task.name === task
        }
      );

      if (taskKey) {
        groupItems.push({
          label: task,
          value: taskKey,
        });
        remainingTasks.delete(taskKey);
      }
      
    });

    groupItems.sort((a, b) => a.label.localeCompare(b.label));

    if (groupItems.length > 0){
      return {
        label: groupName,
        items: groupItems,
      };
    } else {
      return null;
    }
  });

  // Handle any remaining tasks that don't fit into predefined groups
  let otherItems = Array.from(remainingTasks).map((taskKey) => ({
    label: props.allVariants[taskKey][0].task.name ?? taskKey,
    value: taskKey,
  }));

  if (otherItems.length > 0) {
    otherItems.sort((a, b) => a.label.localeCompare(b.label));

    groupedOptions.push({
      label: "Other",
      items: otherItems,
    });
  }
  return groupedOptions.filter((group) => group !== null);
});

watch(
  () => props.inputVariants,
  (newVariants) => {
    // @TODO: Fix this as it's not working as expected. When updating the data set in the parent component, the data is
    // added twice to the selectedVariants array, despite the _union call.
    selectedVariants.value = _union(selectedVariants.value, newVariants);

    // Update the conditions for the variants that were pre-existing
    selectedVariants.value = selectedVariants.value.map((variant) => {
      const preExistingInfo = props.preExistingAssessmentInfo.find((info) => info?.variantId === variant?.id);

      if (preExistingInfo) {
        return { ...variant, variant: { ...variant?.variant, conditions: preExistingInfo.conditions } };
      }
      return variant;
    });
  },
);

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
  Object.values(props.allVariants).forEach((variants) => {
    const matchingVariants = _filter(variants, (variant) => {
      if (
        _toLower(variant.variant.name).includes(_toLower(term)) ||
        _toLower(variant.id).includes(_toLower(term)) ||
        _toLower(variant.task.id).includes(_toLower(term)) ||
        _toLower(variant.task.studentFacingName).includes(_toLower(term))
      )
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

// Handle card move events
const debounceToast = _debounce(
  () => {
    toast.add({ severity: 'error', summary: 'Duplicate', detail: 'That variant is already selected.', life: 3000 });
  },
  3000,
  { leading: true },
);

const handleCardAdd = (card) => {
  // Check if the current task is already selected.
  const taskIds = [];
  // Add fires after the move is complete, so check if there is a duplicate task in the list.
  for (const variant of selectedVariants.value) {
    // If the duplicate task is also the current task, send a warn toast.
    if (taskIds.includes(variant.task.id) && variant.task.id === card.item.dataset.taskId) {
      toast.add({
        severity: 'warn',
        summary: 'Task Selected',
        detail: 'There is a task with that Task ID already selected.',
        life: 3000,
      });
    } else {
      taskIds.push(variant.task.id);
    }
  }
};

const handleCardMove = (card) => {
  // Check if this variant card is already in the list
  const cardVariantId = card.dragged.id;
  const index = _findIndex(selectedVariants.value, (element) => element.id === cardVariantId);
  if (index !== -1 && card.from !== card.to) {
    debounceToast();
    return false;
  } else return true;
};

watch(
  selectedVariants,
  (variants) => {
    emit('variants-changed', variants);
  },
  { deep: true },
);

// Card event handlers
const removeCard = (variant) => {
  selectedVariants.value = selectedVariants.value.filter((selectedVariant) => selectedVariant.id !== variant.id);
};
const selectCard = (variant) => {
  // Check if this variant is already in the list
  const cardVariantId = variant.id;
  const index = _findIndex(selectedVariants.value, (element) => element.id === cardVariantId);
  if (index === -1) {
    // If this variant is not already selected, check if the taskId is already selected.
    // If so, warn but add regardless.
    const selectedTasks = selectedVariants.value.map((selectedVariant) => selectedVariant.task.id);
    if (selectedTasks.includes(variant.task.id)) {
      toast.add({
        severity: 'warn',
        summary: 'Task Selected',
        detail: 'There is a task with that Task ID already selected.',
        life: 3000,
      });
    }

    const defaultedVariant = addChildDefaultCondition(variant);
    selectedVariants.value.push(defaultedVariant);
  } else {
    debounceToast();
  }
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

// Default all tasks to child only, unless it is the survey (for LEVANTE).
function addChildDefaultCondition(variant) {
  if (variant.task.id === 'survey') return variant;

  const defaultedVariant = _cloneDeep(variant);
  defaultedVariant.variant['conditions'] = {}
  defaultedVariant.variant['conditions']['assigned'] = {
    op: 'AND',
    conditions: [
      { field: 'userType', op: 'EQUAL', value: 'student' },
    ],
  };
  return defaultedVariant;
}

</script>
<style lang="scss">
.select-group-name {
  font-style: italic;
}
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
  // TODO: Figure out how to reference SCSS variable $lg, rather than 992px
  @media screen and (min-width: 992px) {
    min-height: 100%;
    max-width: 0;
    border-left: 1px solid var(--surface-d);
  }
  // TODO: Figure out how to reference SCSS variable $lg, rather than 992px
  @media screen and (max-width: 992px) {
    min-width: 100%;
    max-height: 0;
    border-bottom: 1px solid var(--surface-d);
  }
}
.panel-title {
  font-size: x-large;
  font-weight: bold;
}
</style>
