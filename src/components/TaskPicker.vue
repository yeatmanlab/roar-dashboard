<template>
  <PvPanel header="Select tasks">
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
                @input="debouncedSearch"
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
            <VueDraggableNext
              v-model="searchResults"
              :group="{ name: 'variants', pull: 'clone', put: false }"
              :sort="false"
              :move="handleCardMove"
              item-key="id"
            >
              <div
                v-for="element in searchResults"
                :id="element.id"
                :key="element.id"
                :data-task-id="element.task.id"
                style="cursor: grab"
              >
                <VariantCard :variant="element" @select="selectCard" />
              </div>
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
                <div class="select-group-name">{{ slotProps.option.label }}</div>
              </div>
            </template>
          </PvSelect>
          <PvScrollPanel style="height: 27.75rem; width: 100%; overflow-y: auto">
            <div v-if="!currentTask">Select a TaskID to display a list of variants.</div>
            <div v-else-if="!currentVariants.length">
              No variants to show. Make sure 'Show only named variants' is unchecked to view all.
              <span class="text-link" @click="namedOnly = false">View all</span>
            </div>
            <VueDraggableNext
              v-model="currentVariants"
              :group="{ name: 'variants', pull: 'clone', put: false }"
              :sort="false"
              :move="handleCardMove"
              item-key="id"
            >
              <div
                v-for="element in currentVariants"
                :id="element.id"
                :key="element.id"
                :data-task-id="element.task.id"
                style="cursor: grab"
              >
                <VariantCard :variant="element" :update-variant="updateVariant" @select="selectCard" />
              </div>
            </VueDraggableNext>
          </PvScrollPanel>
        </div>
      </div>
      <div v-else class="w-1 bg-gray-400">
        <i class="pi pi-angle-double-right" />
      </div>
      <div class="divider"></div>
      <div class="w-full lg:w-6" data-cy="panel-droppable-zone">
        <div class="panel-title mb-2 text-base">Selected tasks</div>
        <PvScrollPanel style="height: 32rem; width: 100%; overflow-y: auto">
          <VueDraggableNext
            v-model="selectedVariants"
            :move="handleCardMove"
            :group="{ name: 'variants', pull: true, put: true, animation: 100 }"
            :sort="true"
            class="w-full h-full overflow-auto"
            item-key="id"
            @add="handleCardAdd"
          >
            <div
              v-for="(element, index) in selectedVariants"
              :id="element.id"
              :key="element.id"
              :data-task-id="element.task.id"
              style="cursor: grab"
            >
              <VariantCard
                :variant="element"
                :index="index"
                has-controls
                :update-variant="updateVariant"
                :pre-existing-assessment-info="getPreExistingInfo(element.id)"
                @remove="removeCard"
                @move-up="moveCardUp"
                @move-down="moveCardDown"
              />
            </div>
          </VueDraggableNext>
        </PvScrollPanel>
      </div>
    </div>
  </PvPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue';
import type { Ref, ComputedRef, Reactive } from 'vue';
import _filter from 'lodash/filter';
import _findIndex from 'lodash/findIndex';
import _debounce from 'lodash/debounce';
import _toLower from 'lodash/toLower';
import _isEmpty from 'lodash/isEmpty';
import _union from 'lodash/union';
import { VueDraggableNext } from 'vue-draggable-next';
import { useToast } from 'primevue/usetoast';
import type { ToastServiceMethods } from 'primevue/toastservice';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvInputText from 'primevue/inputtext';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import VariantCard from './VariantCard.vue';
import type { VariantData, PreExistingAssessmentInfo } from './VariantCard.vue';
import _cloneDeep from 'lodash/cloneDeep';
import PvIconField from 'primevue/iconfield';
import PvInputIcon from 'primevue/inputicon';

interface TaskOption {
  label: string;
  value: string;
}

interface TaskGroupOption {
  label: string;
  items: TaskOption[];
}

interface AllVariantsProp {
  [taskId: string]: VariantData[];
}

interface Props {
  allVariants: AllVariantsProp;
  inputVariants?: VariantData[];
  preExistingAssessmentInfo?: PreExistingAssessmentInfo[];
}

interface DragEventData {
  relatedContext: {
    list: VariantData[];
    element: VariantData;
  };
  draggedContext: {
    element: VariantData;
    futureIndex: number;
  };
}

const toast: ToastServiceMethods = useToast();

const props = withDefaults(defineProps<Props>(), {
  inputVariants: () => [],
  preExistingAssessmentInfo: () => [],
});

const emit = defineEmits<{ (e: 'variants-changed', variants: VariantData[]): void }>();

const groupedTasks: Record<string, string[]> = {
  "Introduction": ['Instructions'],
  "Language and Literacy": [
    "Vocabulary",
    "Sentence Understanding",
    "Language Sounds",
    "Word Reading",
    "Sentence Reading",
  ],
  "Executive Function": ["Hearts and Flowers", "Same & Different", "Memory"],
  "Math": ["Math"],
  "Spatial Cognition": ["Shape Rotation"],
  "Social Cognition": ["Stories"],
};

const searchTerm: Ref<string> = ref('');
const isSearching: Ref<boolean> = ref(false);
const searchResults: Ref<VariantData[]> = ref([]);
const currentTask: Ref<string | undefined> = ref(undefined);
const namedOnly: Ref<boolean> = ref(true);
const tasksPaneOpen: Ref<boolean> = ref(true);
const selectedVariants: Ref<VariantData[]> = ref(_cloneDeep(props.inputVariants));

const taskOptions: ComputedRef<TaskGroupOption[]> = computed(() => {
  let remainingTasks = new Set(Object.keys(props.allVariants));
  let groupedOptions: TaskGroupOption[] = Object.entries(groupedTasks).map(([groupName, tasks]) => {
    let groupItems: TaskOption[] = [];

    tasks.forEach((taskName) => {
      const taskKey = Object.keys(props.allVariants).find((key) => {
        const variants = props.allVariants[key];
        return variants && variants.length > 0 && variants[0].task.name === taskName;
      });

      if (taskKey) {
        groupItems.push({ label: taskName, value: taskKey });
        remainingTasks.delete(taskKey);
      }
    });

    groupItems.sort((a, b) => a.label.localeCompare(b.label));
    return { label: groupName, items: groupItems };
  }).filter(group => group.items.length > 0);

  let otherItems: TaskOption[] = Array.from(remainingTasks).map((taskKey) => ({
    label: props.allVariants[taskKey]?.[0]?.task?.name ?? taskKey,
    value: taskKey,
  }));

  if (otherItems.length > 0) {
    otherItems.sort((a, b) => a.label.localeCompare(b.label));
    groupedOptions.push({ label: "Other", items: otherItems });
  }
  return groupedOptions;
});

const currentVariants: ComputedRef<VariantData[]> = computed(() => {
  if (!currentTask.value || !props.allVariants[currentTask.value]) {
    return [];
  }
  const variants = props.allVariants[currentTask.value];
  return namedOnly.value
    ? _filter(variants, (v) => v.variant.name !== 'default')
    : variants;
});

const clearSearch = (): void => {
  searchTerm.value = '';
  searchResults.value = [];
};

const performSearch = (): void => {
  if (searchTerm.value.length < 3) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }
  isSearching.value = true;
  const lowerSearchTerm = _toLower(searchTerm.value);
  const results: VariantData[] = [];
  Object.values(props.allVariants).flat().forEach(variant => {
    if (
      _toLower(variant.variant.name).includes(lowerSearchTerm) ||
      _toLower(variant.id).includes(lowerSearchTerm) ||
      _toLower(variant.task.id).includes(lowerSearchTerm)
    ) {
      results.push(variant);
    }
  });
  searchResults.value = results;
  isSearching.value = false;
};

const debouncedSearch = _debounce(performSearch, 300);

const handleCardMove = (evt: DragEventData): boolean => {
  const draggedId = evt.draggedContext.element.id;
  const targetList = evt.relatedContext.list;
  const isDuplicate = targetList.some(item => item.id === draggedId);

  if (targetList === selectedVariants.value && isDuplicate) {
    toast.add({ severity: 'warn', summary: 'Duplicate Task', detail: 'This task variant is already selected.', life: 3000 });
    return false;
  }
  return true;
};

const handleCardAdd = (evt: { newIndex: number }): void => {
  emit('variants-changed', _cloneDeep(selectedVariants.value));
};

const updateVariant = (updatedVariant: VariantData): void => {
  const index = _findIndex(selectedVariants.value, { id: updatedVariant.id });
  if (index !== -1) {
    selectedVariants.value[index] = _cloneDeep(updatedVariant);
    emit('variants-changed', _cloneDeep(selectedVariants.value));
  }
};

const removeCard = (index: number): void => {
  if (index >= 0 && index < selectedVariants.value.length) {
    selectedVariants.value.splice(index, 1);
    emit('variants-changed', _cloneDeep(selectedVariants.value));
  }
};

const moveCardUp = (index: number): void => {
  if (index > 0) {
    const item = selectedVariants.value.splice(index, 1)[0];
    selectedVariants.value.splice(index - 1, 0, item);
    emit('variants-changed', _cloneDeep(selectedVariants.value));
  }
};

const moveCardDown = (index: number): void => {
  if (index < selectedVariants.value.length - 1) {
    const item = selectedVariants.value.splice(index, 1)[0];
    selectedVariants.value.splice(index + 1, 0, item);
    emit('variants-changed', _cloneDeep(selectedVariants.value));
  }
};

const selectCard = (variant: VariantData): void => {
  const isDuplicate = selectedVariants.value.some(item => item.id === variant.id);
  if (isDuplicate) {
      toast.add({ severity: 'warn', summary: 'Duplicate Task', detail: 'This task variant is already selected.', life: 3000 });
      return;
  }
  selectedVariants.value.push(_cloneDeep(variant));
  emit('variants-changed', _cloneDeep(selectedVariants.value));
};

const getPreExistingInfo = (variantId: string): PreExistingAssessmentInfo | undefined => {
  return props.preExistingAssessmentInfo?.find(info => info.id === variantId);
};

watch(props.inputVariants, (newVal) => {
  selectedVariants.value = _cloneDeep(newVal);
});

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
  @media screen and (min-width: 992px) {
    min-height: 100%;
    max-width: 0;
    border-left: 1px solid var(--surface-d);
  }
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
