<template>
  <PvPanel>
    <template #header>
      <div class="flex align-items-center font-bold">
        Select Tasks <span class="required-asterisk text-red-500 ml-1">*</span>
      </div>
    </template>
    <div class="w-full flex flex-column lg:flex-row gap-3">
      <div v-if="tasksPaneOpen" class="w-full lg:w-6">
        <div class="flex flex-row mb-2">
          <div class="flex flex-column flex-grow-1 p-input-icon-left">
            <PvIconField class="w-full">
              <PvInputIcon class="pi pi-search"></PvInputIcon>
              <PvInputText
                v-model="searchTerm"
                class="w-full"
                placeholder="Task or Variant name. Ex. 'Stories' or 'adaptive'"
                data-cy="input-variant-name"
              />
            </PvIconField>
          </div>
          <PvButton
            v-if="searchTerm"
            class="bg-primary text-white border-none border-round pl-3 pr-3 hover:bg-red-900 ml-2"
            @click="clearSearch"
          >
            <i class="pi pi-times" />
          </PvButton>
        </div>
        <div v-if="searchTerm.length > 0">
          <div v-if="isSearching">
            <span>Searching...</span>
          </div>
          <div v-else-if="_isEmpty(searchResults)">
            <span>No search results for {{ searchTerm }}</span>
          </div>
          <PvScrollPanel class="task-picker-scroll-panel" style="height: 31rem; width: 100%; overflow-y: auto">
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
        <div v-else>
          <PvScrollPanel class="task-picker-scroll-panel" style="height: 31rem; width: 100%; overflow-y: auto">
            <div v-if="_isEmpty(groupedTaskSections)">No tasks available.</div>
            <div v-else class="flex flex-column gap-4 pr-1">
              <div
                v-for="section in groupedTaskSections"
                :key="section.label"
                class="task-section flex flex-column gap-3"
              >
                <div class="task-section-title text-lg font-semibold text-900 underline">{{ section.label }}</div>
                <div
                  v-for="task in section.tasks"
                  :key="task.key"
                  class="task-section-group flex flex-column gap-2 border-round surface-border surface-card p-3"
                >
                  <div class="task-section-task-name font-semibold text-base text-800">{{ task.label }}</div>
                  <div v-if="!task.variants.length" class="task-section-empty text-sm text-600">
                    <template v-if="task.totalVariantCount === 0"> No variants to show. </template>
                    <template v-else>
                      No variants to show. Make sure 'Show only named variants' is unchecked to view all.
                      <span v-if="namedOnly" class="text-link ml-1" @click="namedOnly = false">View all</span>
                    </template>
                  </div>
                  <VueDraggableNext
                    v-else
                    :list="task.variants"
                    :reorderable-columns="true"
                    :group="{ name: 'variants', pull: 'clone', put: false }"
                    :sort="false"
                    :move="handleCardMove"
                  >
                    <transition-group>
                      <div
                        v-for="element in task.variants"
                        :id="element.id"
                        :key="element.id"
                        :data-task-id="element.task.id"
                        style="cursor: grab"
                      >
                        <VariantCard :variant="element" :update-variant="updateVariant" @select="selectCard" />
                      </div>
                    </transition-group>
                  </VueDraggableNext>
                </div>
              </div>
            </div>
          </PvScrollPanel>
        </div>
      </div>
      <div v-else class="w-1 bg-gray-400">
        <i class="pi pi-angle-double-right" />
      </div>
      <div class="divider"></div>
      <div class="w-full lg:w-6" data-cy="panel-droppable-zone">
        <div class="panel-title mb-2 text-base">
          Selected Tasks<span class="required-asterisk text-red-500 ml-1">*</span>
        </div>
        <PvScrollPanel class="task-picker-scroll-panel" style="height: 32rem; width: 100%; overflow-y: auto">
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
<script setup lang="ts">
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
import PvInputText from 'primevue/inputtext';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import VariantCard from './VariantCard.vue';
import _cloneDeep from 'lodash/cloneDeep';
import PvIconField from 'primevue/iconfield';
import PvInputIcon from 'primevue/inputicon';

// Import types from VariantCard
type VariantObject = InstanceType<typeof VariantCard>['$props']['variant'];

interface TaskData {
  id: string;
  name: string;
}

interface VariantCondition {
  field: string;
  op: string;
  value: any;
}

interface VariantConditions {
  assigned?: {
    op: string;
    conditions: VariantCondition[];
  };
  optional?:
    | boolean
    | {
        op: string;
        conditions: VariantCondition[];
      };
}

interface VariantData {
  name: string;
  params?: Record<string, any>;
  conditions?: VariantConditions;
  [key: string]: any;
}

interface Variant {
  id: string;
  task: TaskData;
  variant: VariantData;
}

interface PreExistingAssessmentInfo {
  variantId: string;
  conditions: VariantConditions;
}

interface Props {
  allVariants: Record<string, VariantObject[]>;
  inputVariants?: VariantObject[];
  preExistingAssessmentInfo?: any[];
}

interface Emits {
  'variants-changed': [variants: VariantObject[]];
}

interface DragEvent {
  item: HTMLElement;
  from: HTMLElement;
  to: HTMLElement;
  dragged: HTMLElement;
}

const toast = useToast();

const props = withDefaults(defineProps<Props>(), {
  inputVariants: () => [],
  preExistingAssessmentInfo: () => [],
});

const emit = defineEmits<Emits>();

const selectedVariants = ref<VariantObject[]>([]);

const groupedTasks: Record<string, string[]> = {
  Introduction: ['Instructions'],
  'Language and Literacy': [
    'Vocabulary',
    'Sentence Understanding',
    'Language Sounds',
    'Word Reading',
    'Sentence Reading',
  ],
  'Executive Function': ['Hearts & Flowers', 'Same & Different', 'Memory'],
  Math: ['Math'],
  Reasoning: ['Pattern Matching'],
  'Spatial Cognition': ['Shape Rotation'],
  'Social Cognition': ['Stories'],
  Attitudes: ['Survey'],
};

const namedOnly = ref<boolean>(true);

interface TaskWithVariants {
  key: string;
  label: string;
  variants: VariantObject[];
  totalVariantCount: number;
}

interface TaskSection {
  label: string;
  tasks: TaskWithVariants[];
}

const groupedTaskSections = computed((): TaskSection[] => {
  const sectionMap = new Map<string, TaskWithVariants[]>();

  const resolveSectionLabel = (taskLabel: string, taskKey: string): string => {
    const entryByLabel = Object.entries(groupedTasks).find(([, tasks]) => tasks.includes(taskLabel));
    if (entryByLabel) return entryByLabel[0];
    const entryByKey = Object.entries(groupedTasks).find(([, tasks]) => tasks.includes(taskKey));
    return entryByKey ? entryByKey[0] : 'Other';
  };

  Object.entries(props.allVariants).forEach(([taskKey, variants]) => {
    const allVariants = variants ?? [];
    const filteredVariants = namedOnly.value ? _filter(allVariants, (variant) => variant.variant.name) : allVariants;
    const taskLabel = allVariants?.[0]?.task?.name || filteredVariants?.[0]?.task?.name || taskKey;
    const sectionLabel = resolveSectionLabel(taskLabel, taskKey);

    if (!sectionMap.has(sectionLabel)) {
      sectionMap.set(sectionLabel, []);
    }

    sectionMap.get(sectionLabel)?.push({
      key: taskKey,
      label: taskLabel,
      variants: filteredVariants,
      totalVariantCount: allVariants.length,
    });
  });

  const sections: TaskSection[] = [];

  Object.keys(groupedTasks).forEach((label) => {
    const tasks = sectionMap.get(label);
    if (!tasks || !tasks.length) return;

    const orderedTasks = tasks.sort((taskA, taskB) => {
      const desiredOrder = groupedTasks[label];
      const indexA = desiredOrder.indexOf(taskA.label);
      const indexB = desiredOrder.indexOf(taskB.label);
      if (indexA !== indexB) {
        const safeIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const safeIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
        return safeIndexA - safeIndexB;
      }
      return taskA.label.localeCompare(taskB.label);
    });

    sections.push({ label, tasks: orderedTasks });
    sectionMap.delete(label);
  });

  const remainingSections = Array.from(sectionMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  remainingSections.forEach(([label, tasks]) => {
    const sortedTasks = tasks.sort((a, b) => a.label.localeCompare(b.label));
    sections.push({ label, tasks: sortedTasks });
  });

  return sections;
});

watch(
  () => props.inputVariants,
  (newVariants) => {
    if (!newVariants) return;
    // @TODO: Fix this as it's not working as expected. When updating the data set in the parent component, the data is
    // added twice to the selectedVariants array, despite the _union call.
    selectedVariants.value = _union(selectedVariants.value, newVariants);

    // Update the conditions for the variants that were pre-existing
    selectedVariants.value = selectedVariants.value.map((variant) => {
      const preExistingInfo = props.preExistingAssessmentInfo.find((info) => info?.variantId === variant?.id);

      if (preExistingInfo) {
        return {
          ...variant,
          variant: {
            ...variant?.variant,
            conditions: preExistingInfo.conditions,
          },
        };
      }
      return variant;
    });
  },
  { deep: true, immediate: true },
);

const updateVariant = (variantId: string, conditions: any): void => {
  const updatedVariants = selectedVariants.value.map((variant) => {
    if (variant.id === variantId) {
      return {
        ...variant,
        variant: { ...variant.variant, conditions: conditions },
      };
    } else {
      return variant;
    }
  });

  selectedVariants.value = updatedVariants;
  return;
};

// Pane handlers
const tasksPaneOpen = ref<boolean>(true);

// Search handlers
const searchTerm = ref<string>('');
const searchResults = ref<VariantObject[]>([]);
const isSearching = ref<boolean>(false);

const searchCards = (term: string): void => {
  isSearching.value = true;
  const nextResults: VariantObject[] = [];
  const normalizedTerm = _toLower(term);

  Object.values(props.allVariants).forEach((variants) => {
    const variantList = variants ?? [];
    const matchingVariants = _filter(variantList, (variant) => {
      if (
        _toLower(variant?.task?.name ?? '').includes(normalizedTerm) ||
        _toLower(variant?.variant?.name ?? '').includes(normalizedTerm)
      ) {
        return true;
      }

      return false;
    });

    nextResults.push(...matchingVariants);
  });

  searchResults.value = nextResults;
  isSearching.value = false;
};

function clearSearch(): void {
  searchTerm.value = '';
  searchResults.value = [];
}

const debounceSearch = _debounce(searchCards, 250);

watch(searchTerm, (term: string) => {
  if (term.length > 0) {
    isSearching.value = true;
    debounceSearch(term);
  } else {
    searchResults.value = [];
    isSearching.value = false;
  }
});

// Handle card move events
const debounceToast = _debounce(
  () => {
    toast.add({
      severity: 'error',
      summary: 'Duplicate',
      detail: 'That variant is already selected.',
      life: 3000,
    });
  },
  3000,
  { leading: true },
);

const handleCardAdd = (card: DragEvent): void => {
  // Check if the current task is already selected.
  const taskIds = selectedVariants.value.map((variant) => variant.task.id);

  // If the task is already selected, remove the added card and show warning
  const taskId = card.item.dataset.taskId;
  if (taskId && taskIds.includes(taskId)) {
    // Remove the last added card (which is the duplicate)
    selectedVariants.value.pop();

    toast.add({
      severity: 'warn',
      summary: 'Task Selected',
      detail: 'There is a task with that Task ID already selected.',
      life: 3000,
    });
  }
};

const handleCardMove = (card: DragEvent): boolean => {
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
  (newSelectedVariants) => {
    emit('variants-changed', newSelectedVariants || selectedVariants.value);
  },
  { deep: true, immediate: true },
);

// Card event handlers
const removeCard = (variant: VariantObject): void => {
  selectedVariants.value = selectedVariants.value.filter((selectedVariant) => selectedVariant.id !== variant.id);
};

const selectCard = (variant: VariantObject): void => {
  // Check if this variant is already in the list
  const cardVariantId = variant.id;
  const index = _findIndex(selectedVariants.value, (element) => element.id === cardVariantId);

  // Check if the taskId is already selected
  const selectedTasks = selectedVariants.value.map((selectedVariant) => selectedVariant.task.id);

  if (index === -1) {
    if (selectedTasks.includes(variant.task.id)) {
      toast.add({
        severity: 'warn',
        summary: 'Task Selected',
        detail: 'There is a task with that Task ID already selected.',
        life: 3000,
      });
      return; // Don't add the card if task is already selected
    }

    const defaultedVariant = addChildDefaultCondition(variant);
    selectedVariants.value.push(defaultedVariant);
  } else {
    debounceToast();
  }
};

const moveCardUp = (variant: VariantObject): void => {
  const index = _findIndex(selectedVariants.value, (currentVariant) => currentVariant.id === variant.id);
  if (index <= 0) return;
  const item = selectedVariants.value[index];
  if (item) {
    selectedVariants.value.splice(index, 1);
    selectedVariants.value.splice(index - 1, 0, item);
  }
};

const moveCardDown = (variant: VariantObject): void => {
  const index = _findIndex(selectedVariants.value, (currentVariant) => currentVariant.id === variant.id);
  if (index === -1 || index >= selectedVariants.value.length - 1) return;
  const item = selectedVariants.value[index];
  if (item) {
    selectedVariants.value.splice(index, 1);
    selectedVariants.value.splice(index + 1, 0, item);
  }
};

// Default all tasks to child only, unless it is the survey (for LEVANTE).
function addChildDefaultCondition(variant: VariantObject): VariantObject {
  if (variant.task.id === 'survey') return variant;

  const defaultedVariant = _cloneDeep(variant);
  defaultedVariant.variant['conditions'] = {};
  defaultedVariant.variant['conditions']['assigned'] = {
    op: 'AND',
    conditions: [{ field: 'userType', op: 'EQUAL', value: 'student' }],
  };
  return defaultedVariant;
}
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
.task-section-group {
  border: 1px solid var(--surface-d);
  background-color: var(--surface-card);
}
.task-section-empty {
  font-style: italic;
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
.task-picker-scroll-panel .p-scrollpanel-bar {
  opacity: 1;
}
</style>
