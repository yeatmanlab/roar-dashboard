<template>
  <div
    v-if="!hasControls"
    class="flex-1 flex h-6rem flex-row gap-2 border-1 border-round surface-border bg-white-alpha-90 mb-2 hover:surface-hover"
  >
    <div class="w-11 mt-3 flex flex-row p-0 mb-2">
      <div>
        <img
          class="w-4rem shadow-2 border-round ml-2"
          :src="variant.task.image || backupImage"
          :alt="variant.task.name"
        />
      </div>
      <div>
        <div class="flex align-items-center flex-row">
          <span class="font-bold text-lg pl-2" >{{ variant.task.name }}</span>
          <PvButton
            class="p-0 surface-hover border-none border-circle hover:text-100 hover:bg-primary ml-2"
            @click="toggle($event)"
            ><i
              v-tooltip.top="'View parameters'"
              class="pi pi-info-circle text-primary p-1 border-circle hover:text-100"
            ></i
          ></PvButton>
          <div v-if="variant?.variant?.params?.cat" class="flex ml-2">
            <PvChip  class="bg-primary text-white h-2rem" label="CAT" />
          </div>
        </div>
        <div class="pl-2 w-full">
          <p class="m-0"><span class="font-semibold">Variant name:</span> {{ variant.variant.name }}</p>
        </div>
        <PvPopover ref="op" append-to="body" style="width: 40vh">
          <div class="flex justify-content-end mt-0 mb-2">
            <PvButton
              class="p-0 surface-hover border-none border-circle -rotate-45 hover:text-100 hover:bg-primary"
              @click="visible = true"
              ><i
                v-tooltip.top="'Click to expand'"
                class="pi pi-arrows-h border-circle p-2 text-primary hover:text-100"
              ></i
            ></PvButton>
          </div>
          <div class="flex gap-2 flex-column w-full pr-3">
            <PvDataTable
              class="p-datatable-small ml-3 border-1 surface-border text-sm"
              header-style="font-size: 20px;"
              :value="displayParamList(variant.variant.params)"
              scrollable
              scroll-height="300px"
            >
              <PvColumn
                field="key"
                header="Parameter"
                style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
              >
              </PvColumn>
              <PvColumn
                field="value"
                header="Value"
                style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
              >
              </PvColumn>
            </PvDataTable>
          </div>
        </PvPopover>
      </div>
    </div>
    <div class="mr-0 pl-0 flex flex-column">
      <PvButton
        v-if="!hasControls"
        class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
        data-cy="selected-variant"
        @click="handleSelect"
        ><i class="pi pi-chevron-right text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
    </div>
  </div>
  <!---------- end card without buttons ----- >-->
  <div v-else :id="variant.id" class="h-6rem" :class="isActive()">
    <div class="ml-0 pl-0 flex flex-column">
      <PvButton
        class="surface-hover border-y-1 border-200 border-noround m-0 hover:bg-primary p-0"
        @click="handleRemove"
        ><i class="pi pi-times text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
      <PvButton
        class="surface-hover border-y-1 border-200 border-noround m-0 hover:bg-primary p-0"
        @click="handleMoveUp"
        ><i class="pi pi-sort-up text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
      <PvButton
        class="surface-hover border-y-1 border-200 border-noround m-0 hover:bg-primary p-0"
        @click="handleMoveDown"
        ><i class="pi pi-sort-down text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i
      ></PvButton>
    </div>
    <div class="w-11 mt-3 flex flex-row p-0">
      <div>
        <img class="w-4rem shadow-2 border-round" :src="variant.task.image || backupImage" :alt="variant.task.name" />
      </div>
      <div>
        <!-- repeated code -->
        <div class="flex align-items-center flex-row">
          <span class="font-bold" style="margin-left: 0.625rem">{{ variant.task.name }}</span>
          <PvButton
            class="p-0 surface-hover border-none border-circle hover:text-100 hover:bg-primary"
            @click="toggle($event)"
            ><i
              v-tooltip.top="'View parameters'"
              class="pi pi-info-circle text-primary p-1 border-circle hover:text-100"
            ></i
          ></PvButton>
          <div v-if="variant?.variant?.params?.cat" class="flex ml-2">
            <PvChip  class="bg-primary text-white h-2rem" label="CAT" />
          </div>
        </div>
        <div class="flex align-items-center gap-2">
          <p class="m-0 mt-1 ml-2">
            <span class="font-bold">Variant name:</span> {{ variant.variant.name }} <br />
            <div
              v-if="variant.variant?.conditions?.assigned?.conditions && variant.variant?.conditions?.assigned.conditions.length > 0"
            >
              <span class="font-bold">Assigned to:</span> {{parseConditions(variant.variant?.conditions?.assigned).map(entry => entry.op === "EQUAL" ? `${entry.value}s` : `not ${entry.value}s`).join(", ")}}<br/>
            </div>
          </p>
        </div>
      </div>
      <PvPopover ref="op" append-to="body" class="border-1 surface-border" style="width: 40vh">
        <div class="flex justify-content-end mt-0 mb-2">
          <PvButton
            class="p-0 surface-hover border-none border-circle -rotate-45 hover:text-100 hover:bg-primary"
            @click="visible = true"
            ><i
              v-tooltip.top="'Click to expand'"
              class="pi pi-arrows-h border-circle p-2 text-primary hover:text-100"
            ></i
          ></PvButton>
        </div>
        <div class="flex gap-2 flex-column w-full pr-3">
          <PvDataTable
            class="p-datatable-small ml-3 border-1 surface-border text-sm p-0"
            header-style="font-size: 20px;"
            :value="displayParamList(variant.variant.params)"
            scrollable
            scroll-height="300px"
          >
            <PvColumn
              field="key"
              header="Parameter"
              style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
            >
            </PvColumn>
            <PvColumn
              field="value"
              header="Value"
              style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
            >
            </PvColumn>
          </PvDataTable>
        </div>
      </PvPopover>
    </div>
    <div class="mr-0 pl-0 flex flex-column">
      <EditVariantDialog
        :assessment="variant"
        :update-variant="updateVariant"
        :pre-existing-assessment-info="preExistingAssessmentInfo"
      />
      <PvButton
        v-if="variant.variant?.conditions?.assigned || variant.variant?.conditions?.optional"
        class="surface-hover border-1 border-300 border-circle m-0 hover:bg-primary p-0 m-2"
        @click="toggleShowContent()"
        ><i :class="iconClass()" style="font-size: 1rem"></i
      ></PvButton>
    </div>
  </div>
  <div
    v-if="showContent"
    class="flex-1 flex flex-column border-1 border-round surface-border surface-hover mb-2 hover:surface-ground mr-2 ml-2 pb-2"
    style="margin-top: -25px"
  >
    <div
      v-if="variant.variant?.conditions?.assigned?.conditions && variant.variant?.conditions?.assigned.conditions.length > 0"
      class="flex gap-2 mt-2 flex-column w-full pr-3"
    >
      <p class="font-bold mt-3 mb-1 ml-3">Assigned Conditions:</p>
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border"
        table-style="min-width:50vh"
        :value="parseConditions(variant.variant?.conditions?.assigned)"
        scrollable
        scroll-height="300px"
      >
        <PvColumn
          field="field"
          header="Field"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh; margin: 0.3vh"
        ></PvColumn>
        <PvColumn field="op" header="Operation" style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh">
        </PvColumn>
        <PvColumn field="value" header="Value" style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh">
        </PvColumn>
      </PvDataTable>
    </div>
    <div v-if="variant.variant?.conditions?.optional === true" class="flex mt-3 flex-column w-full ml-3 pr-5">
      <PvTag severity="success"> Assignment optional for all students </PvTag>
    </div>
    <div
      v-else-if="typeof variant.variant?.conditions?.optional === 'object' && variant.variant.conditions.optional?.conditions && variant.variant.conditions.optional.conditions.length > 0"
      class="flex mt-2 flex-column w-full pr-3"
    >
      <p class="font-bold mt-3 mb-1 ml-3">Optional Conditions:</p>
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border"
        table-style="min-width:50vh"
        :value="parseConditions(variant.variant?.conditions?.optional)"
        scrollable
        scroll-height="300px"
      >
        <PvColumn
          field="field"
          header="Field"
          style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh"
        ></PvColumn>
        <PvColumn field="op" header="Operation" style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh">
        </PvColumn>
        <PvColumn field="value" header="Value" style="width: 33%; text-align: left; padding-left: 1vh; padding: 0.8vh">
        </PvColumn>
      </PvDataTable>
    </div>
    <div
      v-if="!variant.variant?.conditions?.assigned && !variant.variant?.conditions?.optional"
      class="flex mt-2 flex-column w-full px-3 ml-3"
    >
      <PvTag severity="danger"> Assignment required for all students </PvTag>
    </div>
  </div>
  <PvDialog v-model:visible="visible" modal header="Parameters" :style="{ width: '50rem' }">
    <div class="flex gap-2 flex-column w-full pr-3">
      <PvDataTable
        class="p-datatable-small ml-3 border-1 surface-border text-xl"
        header-style="font-size: 20px;"
        :value="displayParamList(variant.variant.params)"
        scrollable
        scroll-height="300px"
      >
        <PvColumn
          field="key"
          header="Parameter"
          style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
        >
        </PvColumn>
        <PvColumn
          field="value"
          header="Value"
          style="width: 50%; text-align: left; padding-left: 1vh; padding-top: 0.15vh; padding-bottom: 0.1vh"
        >
        </PvColumn>
      </PvDataTable>
    </div>
  </PvDialog>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import PvButton from 'primevue/button';
import PvChip from 'primevue/chip';
import PvDataTable from 'primevue/datatable';
import PvColumn from 'primevue/column';
import PvDialog from 'primevue/dialog';
import PvPopover from 'primevue/popover';
import PvTag from 'primevue/tag';
import _isEmpty from 'lodash/isEmpty';

// Interfaces
interface Task {
  id: string;
  name: string;
  image?: string | null;
  // Add other task properties if they exist
}

// Structure for displayParamList output
interface ParamListItem {
  key: string;
  value: string;
}

// Simplified Condition structure
interface Condition {
  field: string;
  op: string; // e.g., "EQUAL", "NOT EQUAL"
  value: string | number | boolean;
}

// Structure for variant conditions
interface AssignmentConditions {
  conditions?: Condition[];
  conjunction?: 'AND' | 'OR'; // Assuming possible conjunctions
}

interface OptionalConditions extends AssignmentConditions {}

interface Variant {
  id: string;
  name: string;
  params?: Record<string, any>; // Generic params object
  conditions?: {
    assigned?: AssignmentConditions;
    optional?: OptionalConditions | boolean; // Can be boolean true or conditions object
  };
  // Add other variant properties if they exist
}

interface VariantData {
  id: string; // Assuming top-level ID exists for the whole item
  task: Task;
  variant: Variant;
}

// Prop type for preExistingAssessmentInfo (adjust based on actual structure)
interface PreExistingAssessmentInfo {
  id: string;
  name: string;
  // Add other necessary properties
}

interface Props {
  variant: VariantData;
  index?: number;
  hasControls?: boolean;
  activeId?: string | null;
  updateVariant?: (updatedVariant: VariantData) => void; // Function prop type
  preExistingAssessmentInfo?: PreExistingAssessmentInfo;
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  hasControls: false,
  activeId: null,
  updateVariant: () => { console.warn('updateVariant function not provided'); },
  preExistingAssessmentInfo: undefined,
});

const emit = defineEmits<{ 
  (e: 'select', variant: VariantData): void;
  (e: 'remove', index: number): void;
  (e: 'moveUp', index: number): void;
  (e: 'moveDown', index: number): void;
}>();

export type {
  VariantData,
  PreExistingAssessmentInfo,
  Condition,
  AssignmentConditions,
  OptionalConditions
}; // Export types needed by EditVariantDialog

const op: Ref<InstanceType<typeof PvPopover> | null> = ref(null);
const visible: Ref<boolean> = ref(false);
const showContent: Ref<boolean> = ref(false);

const backupImage: ComputedRef<string> = computed(() => '/img/placeholders/task.png');

const displayParamList = (params: Record<string, any> | undefined): ParamListItem[] => {
  if (!params) return [];
  return Object.entries(params).map(([key, value]) => ({
    key,
    // Handle non-string values gracefully
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  }));
};

// Type the event parameter
const toggle = (event: Event): void => {
  op.value?.toggle(event);
};

const toggleShowContent = (): void => {
  showContent.value = !showContent.value;
};

const handleSelect = (): void => {
  emit('select', props.variant);
};

const handleRemove = (): void => {
  emit('remove', props.index);
};

const handleMoveUp = (): void => {
  emit('moveUp', props.index);
};

const handleMoveDown = (): void => {
  emit('moveDown', props.index);
};

const isActive = (): string => {
  return props.variant.id === props.activeId
    ? 'flex flex-1 flex-row gap-0 border-1 border-round surface-border mb-2 surface-ground'
    : 'flex flex-1 flex-row gap-0 border-1 border-round surface-border mb-2 surface-card';
};

const iconClass = (): string => {
  return showContent.value
    ? 'pi pi-chevron-up text-primary hover:text-white-alpha-90 p-2'
    : 'pi pi-chevron-down text-primary hover:text-white-alpha-90 p-2';
};

// Type the conditions parameter
const parseConditions = (conditions: AssignmentConditions | OptionalConditions | boolean | undefined): Condition[] => {
  if (!conditions || typeof conditions === 'boolean') {
      return [];
  }
  return conditions.conditions ?? [];
};

// @ts-ignore - TS struggles with inferring types from Vue SFC imports here
const EditVariantDialog = defineAsyncComponent(() => import('@/components/EditVariantDialog.vue'));

</script>

<style scoped>
/* Styles specific to VariantCard */
.hover\:surface-hover:hover {
  background-color: var(--surface-hover);
}
.hover\:surface-ground:hover {
  background-color: var(--surface-ground);
}
</style>
