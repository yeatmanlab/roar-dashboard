<template>
  <PvPanel>
    <template #header>
      <div class="flex align-items-center font-bold">
        Select Tasks <span class="required-asterisk text-red-500 ml-1">*</span>
      </div>
    </template>
    <div class="w-full flex flex-column lg:flex-row gap-3">
      <div class="w-full lg:w-6">
        <PvSelect
          v-model="selectedLanguage"
          :options="languages"
          option-label="name"
          placeholder="Select language"
          showClear
          class="languages-dropdown"
        />

        <div class="flex flex-row gap-2 my-2">
          <div class="flex flex-column flex-grow-1 p-input-icon-left">
            <PvIconField class="w-full">
              <PvInputIcon class="pi pi-search" />
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
            class="bg-primary text-white border-none border-round pl-3 pr-3 hover:bg-red-900"
            @click="clearSearch"
          >
            <i class="pi pi-times" />
          </PvButton>
        </div>
        <div v-if="selectedLanguage || isUserSuperAdmin()">
          <div v-if="searchTerm.length > 0">
            <div v-if="isSearching">
              <span>Searching...</span>
            </div>
            <div v-else-if="!searchMatchesAll.length">
              <span>No search results for {{ searchTerm }}</span>
            </div>
            <div v-else-if="!availableSearchResults.length">
              <span>All search results are already selected.</span>
            </div>
            <PvScrollPanel v-else class="task-picker-scroll-panel task-picker-scroll-panel--fixed">
              <VueDraggableNext
                v-model="availableSearchResults"
                :reorderable-columns="true"
                :group="{ name: 'variants', pull: 'clone', put: false }"
                :sort="false"
                :move="handleCardMove"
              >
                <transition-group>
                  <div
                    v-for="element in availableSearchResults"
                    :id="element.id"
                    :key="element.id"
                    :data-task-id="getTaskId(element.task)"
                    class="cursor-grab"
                  >
                    <VariantCard :variant="element" :update-variant="bindUpdateVariant" @select="selectCard" />
                  </div>
                </transition-group>
              </VueDraggableNext>
            </PvScrollPanel>
          </div>
          <div v-else>
            <PvScrollPanel class="task-picker-scroll-panel task-picker-scroll-panel--fixed">
              <div v-if="!groupedTaskSections.length">No tasks available.</div>

              <PvAccordion v-else>
                <PvAccordionPanel v-for="section in groupedTaskSections" :key="section.label" :value="section.label">
                  <PvAccordionHeader>{{ section.label }}</PvAccordionHeader>
                  <PvAccordionContent>
                    <div class="flex flex-column gap-2">
                      <div
                        v-for="task in section.tasks"
                        :key="task.key"
                        class="task-section-group flex flex-column gap-2 border-round surface-border surface-card p-3"
                      >
                        <div class="task-section-task-name font-semibold text-base text-800">{{ task.label }}</div>
                        <div v-if="!task.variants.length" class="task-section-empty text-sm text-600">
                          No variants to show.
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
                              :data-task-id="getTaskId(element.task)"
                              class="cursor-grab"
                            >
                              <VariantCard
                                :variant="element"
                                :update-variant="bindUpdateVariant"
                                @select="selectCard"
                              />
                            </div>
                          </transition-group>
                        </VueDraggableNext>
                      </div>
                    </div>
                  </PvAccordionContent>
                </PvAccordionPanel>
              </PvAccordion>
            </PvScrollPanel>
          </div>
        </div>
        <small v-else>Select a language to display the task list</small>
      </div>
      <div class="divider"></div>
      <div class="w-full lg:w-6" data-cy="panel-droppable-zone">
        <div class="panel-title mb-2 text-base">
          Selected Tasks<span class="required-asterisk text-red-500 ml-1">*</span>
        </div>

        <div ref="selectedTasksScrollPanelRef" class="task-picker-scroll-panel">
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
                :data-task-id="getTaskId(element.task)"
                class="cursor-grab"
              >
                <VariantCard
                  :variant="element"
                  has-controls
                  :update-variant="bindUpdateVariant"
                  :pre-existing-assessment-info="preExistingAssessmentInfo"
                  @remove="removeCard"
                  @move-up="moveCardUp"
                  @move-down="moveCardDown"
                />
              </div>
            </transition-group>
          </VueDraggableNext>
        </div>
      </div>
    </div>
  </PvPanel>
</template>

<script setup lang="ts">
import { formattedVariantName } from '@/helpers';
import { languageOptions } from '@/translations/i18n';
import _cloneDeep from 'lodash/cloneDeep';
import _debounce from 'lodash/debounce';
import PvAccordion from 'primevue/accordion';
import PvAccordionContent from 'primevue/accordioncontent';
import PvAccordionHeader from 'primevue/accordionheader';
import PvAccordionPanel from 'primevue/accordionpanel';
import PvButton from 'primevue/button';
import PvIconField from 'primevue/iconfield';
import PvInputIcon from 'primevue/inputicon';
import PvInputText from 'primevue/inputtext';
import PvPanel from 'primevue/panel';
import PvScrollPanel from 'primevue/scrollpanel';
import PvSelect from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, ref, watch } from 'vue';
import { VueDraggableNext } from 'vue-draggable-next';
import VariantCard from './VariantCard.vue';
import { useAuthStore } from '@/store/auth';

type VariantObject = InstanceType<typeof VariantCard>['$props']['variant'];

interface PreExistingAssessmentRecord {
  variantId: string;
  conditions: VariantObject['variant']['conditions'];
}

interface Props {
  allVariants: Record<string, VariantObject[]>;
  inputVariants?: VariantObject[];
  preExistingAssessmentInfo?: PreExistingAssessmentRecord[];
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

const getTaskId = (task: VariantObject['task']): string => (task as unknown as { id: string }).id;

const LANGUAGE_PREFIX_MATCH_TASK_IDS = new Set(['swr', 'sre', 'pa']);

function getLanguagePrefix(locale: string): string {
  return locale.split('-')[0] ?? locale.slice(0, 2);
}

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
  Surveys: ['Child Survey', 'Caregiver Survey', 'Teacher Survey'],
};

const props = withDefaults(defineProps<Props>(), {
  inputVariants: () => [],
  preExistingAssessmentInfo: () => [],
});

const emit = defineEmits<Emits>();
const toast = useToast();
const authStore = useAuthStore();
const { isUserSuperAdmin } = authStore;

const languages = computed(() =>
  Object.entries(languageOptions).map(([key, options]) => ({
    name: options.languageTaskPicker,
    value: key,
  })),
);

const availableSearchResults = ref<VariantObject[]>([]);
const isSearching = ref(false);
const searchMatchesAll = ref<VariantObject[]>([]);
const searchTerm = ref('');
const selectedLanguage = ref<{ name: string; value: string } | null>(null);
const selectedTasksScrollPanelRef = ref<HTMLElement | null>(null);
const selectedVariants = ref<VariantObject[]>([]);

const selectedVariantIdSet = computed(() => new Set(selectedVariants.value.map((v) => v.id)));

const rebuildAvailableSearchResults = (): void => {
  availableSearchResults.value = searchMatchesAll.value.filter(
    (variant) => !selectedVariantIdSet.value.has(variant.id),
  );
};

// @TODO: Remove the following function after normalizing the variant docs
const formatVariantLanguage = (variantLanguage: string): string => {
  if (!variantLanguage) return '';

  if (variantLanguage === 'en') return 'en-us';
  if (variantLanguage === 'es') return 'es-co';
  if (variantLanguage === 'de') return 'de-de';

  return variantLanguage?.toLowerCase();
};

const variantsByLanguage = (variants: VariantObject[] = []): VariantObject[] => {
  if (!selectedLanguage.value) return variants;

  const selectedLang = selectedLanguage.value.value.toLowerCase();

  return variants.filter((variant) => {
    const variantLanguage = variant.variant?.params?.language?.toLowerCase();
    if (!variantLanguage) return false;
    if (variantLanguage === 'all languages') return true;

    const formattedVariantLanguage = formatVariantLanguage(variantLanguage);
    const taskId = getTaskId(variant.task).toLowerCase();

    if (LANGUAGE_PREFIX_MATCH_TASK_IDS.has(taskId)) {
      return getLanguagePrefix(selectedLang) === getLanguagePrefix(formattedVariantLanguage);
    }

    const exactLangMatch = formattedVariantLanguage === selectedLang;
    const langPrefixMatch = selectedLang.includes(formattedVariantLanguage);

    return exactLangMatch || langPrefixMatch;
  });
};

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
    const namedVariants = allVariants.filter((variant) => variant.variant.name) as VariantObject[];
    const filteredVariants = variantsByLanguage(namedVariants);
    const orderedVariants = filteredVariants.slice().sort((variantA, variantB) => {
      const variantNameA = formattedVariantName(variantA?.variant?.name?.trim() ?? '');
      const variantNameB = formattedVariantName(variantB?.variant?.name?.trim() ?? '');
      return variantNameA.localeCompare(variantNameB, undefined, { sensitivity: 'base' });
    });
    const visibleVariants = orderedVariants.filter((variant) => !selectedVariantIdSet.value.has(variant.id));
    const taskLabel = allVariants?.[0]?.task?.name || filteredVariants?.[0]?.task?.name || taskKey;
    const sectionLabel = resolveSectionLabel(taskLabel, taskKey);

    if (!sectionMap.has(sectionLabel)) {
      sectionMap.set(sectionLabel, []);
    }

    sectionMap.get(sectionLabel)?.push({
      key: taskKey,
      label: taskLabel,
      variants: visibleVariants,
      totalVariantCount: allVariants.length,
    });
  });

  const sections: TaskSection[] = [];

  Object.keys(groupedTasks).forEach((label) => {
    const tasks = sectionMap.get(label);
    if (!tasks?.length) return;

    const orderedTasks = tasks.sort((taskA, taskB) => {
      const desiredOrder = groupedTasks[label as keyof typeof groupedTasks] ?? [];
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

const compareVariantNames = (variantA: VariantObject, variantB: VariantObject): number => {
  const variantNameA = formattedVariantName(variantA?.variant?.name?.trim() ?? '');
  const variantNameB = formattedVariantName(variantB?.variant?.name?.trim() ?? '');
  return variantNameA.localeCompare(variantNameB, undefined, { sensitivity: 'base' });
};

const searchCards = (term: string): void => {
  isSearching.value = true;
  const nextResults: VariantObject[] = [];
  const normalizedTerm = term.toLowerCase();

  Object.values(props.allVariants).forEach((variants) => {
    const variantList = variants ?? [];
    const matchingVariants = variantList.filter(({ task, variant }) => {
      const taskName = (task?.name ?? '').toLowerCase();
      const variantName = (variant?.name ?? '').toLowerCase();
      return taskName.includes(normalizedTerm) || variantName.includes(normalizedTerm);
    });

    const filteredVariants = variantsByLanguage(matchingVariants as VariantObject[]);
    const orderedVariants = filteredVariants.slice().sort(compareVariantNames);
    nextResults.push(...orderedVariants);
  });

  searchMatchesAll.value = nextResults;
  rebuildAvailableSearchResults();
  isSearching.value = false;
};

const clearSearch = (): void => {
  searchTerm.value = '';
  searchMatchesAll.value = [];
  availableSearchResults.value = [];
};

const debounceSearch = _debounce(searchCards, 250);

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

const updateVariant = (variantId: string, conditions: VariantObject['variant']['conditions']): void => {
  selectedVariants.value = selectedVariants.value.map((variant) =>
    variant.id === variantId ? { ...variant, variant: { ...variant.variant, conditions } } : variant,
  );
};

const bindUpdateVariant = updateVariant as unknown as (variant: VariantObject) => void;

const handleCardAdd = (card: DragEvent): void => {
  const taskIds = selectedVariants.value.map((variant) => getTaskId(variant.task));
  const droppedTaskId = card.item.dataset.taskId;
  if (droppedTaskId && taskIds.includes(droppedTaskId)) {
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
  const cardVariantId = card.dragged.id;
  const index = selectedVariants.value.findIndex((element) => element.id === cardVariantId);
  if (index !== -1 && card.from !== card.to) {
    debounceToast();
    return false;
  }
  return true;
};

const removeCard = (variant: VariantObject): void => {
  selectedVariants.value = selectedVariants.value.filter((selectedVariant) => selectedVariant.id !== variant.id);
};

const addUserDefaultCondition = (variant: VariantObject): VariantObject => {
  const defaultedVariant = _cloneDeep(variant);
  const id = getTaskId(variant.task);
  const conditions: Record<string, unknown> = {};

  if (id === 'teacher-survey') {
    conditions.assigned = {
      op: 'AND',
      conditions: [{ field: 'userType', op: 'EQUAL', value: 'teacher' }],
    };
  } else if (id === 'caregiver-survey' || id === 'adult-reasoning') {
    conditions.assigned = {
      op: 'AND',
      conditions: [{ field: 'userType', op: 'EQUAL', value: 'parent' }],
    };
  } else {
    conditions.assigned = {
      op: 'AND',
      conditions: [{ field: 'userType', op: 'EQUAL', value: 'student' }],
    };
  }

  defaultedVariant.variant.conditions = conditions as VariantObject['variant']['conditions'];
  return defaultedVariant;
};

const selectCard = (variant: VariantObject): void => {
  const index = selectedVariants.value.findIndex((element) => element.id === variant.id);
  const selectedTaskIds = selectedVariants.value.map((selectedVariant) => getTaskId(selectedVariant.task));

  if (index === -1) {
    if (selectedTaskIds.includes(getTaskId(variant.task))) {
      toast.add({
        severity: 'warn',
        summary: 'Task Selected',
        detail: 'There is a task with that Task ID already selected.',
        life: 3000,
      });
      return;
    }
    selectedVariants.value.push(addUserDefaultCondition(variant));
    return;
  }
  debounceToast();
};

const moveCardUp = (variant: VariantObject): void => {
  const index = selectedVariants.value.findIndex((currentVariant) => currentVariant.id === variant.id);
  if (index <= 0) return;
  const item = selectedVariants.value[index];
  if (!item) return;
  selectedVariants.value.splice(index, 1);
  selectedVariants.value.splice(index - 1, 0, item);
};

const moveCardDown = (variant: VariantObject): void => {
  const index = selectedVariants.value.findIndex((currentVariant) => currentVariant.id === variant.id);
  if (index === -1 || index >= selectedVariants.value.length - 1) return;
  const item = selectedVariants.value[index];
  if (!item) return;
  selectedVariants.value.splice(index, 1);
  selectedVariants.value.splice(index + 1, 0, item);
};

watch(
  () => props.inputVariants,
  (newVariants) => {
    if (!newVariants) return;
    selectedVariants.value = _cloneDeep(newVariants).map((variant) => {
      const preExistingInfo = props.preExistingAssessmentInfo.find((info) => info?.variantId === variant?.id);
      if (!preExistingInfo) return variant;
      return {
        ...variant,
        variant: {
          ...variant?.variant,
          conditions: preExistingInfo.conditions,
        },
      };
    }) as VariantObject[];
  },
  { deep: true, immediate: true },
);

watch(
  () => selectedVariants.value.length,
  async () => {
    await nextTick();
    const panel = selectedTasksScrollPanelRef.value;
    if (!panel) return;
    panel.scrollTop = panel.scrollHeight;
  },
);

watch(
  () => selectedLanguage.value,
  () => {
    if (searchTerm.value.trim().length) {
      searchCards(searchTerm.value);
    }
  },
);

watch(searchTerm, (term: string) => {
  if (term.length > 0) {
    isSearching.value = true;
    debounceSearch(term);
  } else {
    searchMatchesAll.value = [];
    availableSearchResults.value = [];
    isSearching.value = false;
  }
});

watch(
  selectedVariants,
  (newSelectedVariants) => {
    emit('variants-changed', newSelectedVariants);
    if (searchMatchesAll.value.length) {
      rebuildAvailableSearchResults();
    }
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss">
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
.task-picker-scroll-panel {
  max-height: 32rem;
  overflow-y: auto;

  .p-scrollpanel-bar {
    opacity: 1;
  }
}
.task-picker-scroll-panel--fixed {
  height: 32rem;
  width: 100%;
}
.languages-dropdown {
  width: auto;
  min-width: 50%;
}
.cursor-grab {
  cursor: grab;
}
</style>
