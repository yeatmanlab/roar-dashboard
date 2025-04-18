<template>
  <PvButton
    class="surface-hover border-1 border-300 border-circle hover:bg-primary p-0 m-2"
    data-cy="button-edit-variant"
    @click="isVisible = true"
  >
    <i class="pi pi-pencil text-primary hover:text-white-alpha-90 p-2" style="font-size: 1rem"></i>
  </PvButton>

  <PvDialog
    v-model:visible="isVisible"
    :draggable="false"
    modal
    header="Edit Conditions"
    :close-on-escape="false"
    :style="{ width: '65vw' }"
    :breakpoints="{ '1199px': '85vw', '575px': '95vw' }"
  >
    <div class="flex w-full align-items-center justify-content-around">
      <div class="flex flex-column w-full my-3 gap-2">
        <div>
          <div class="text-sm font-light uppercase text-gray-400">Task Name</div>
          <div class="text-3xl font-bold uppercase">
            {{ assessment.task.id }}
          </div>
        </div>
        <div v-if="assessment.variant?.params?.taskName" class="gap-2">
          <div class="text-sm font-light uppercase text-gray-500">Variant Name</div>
          <div class="text-xl uppercase">
            {{ assessment.variant?.params?.taskName }}
          </div>
        </div>
      </div>
      <div class="flex w-6 justify-content-end">
        <img :src="assessment.task.image" class="w-5" />
      </div>
    </div>
    <div class="flex flex-column w-full my-2 gap-2">
      <div class="card p-fluid bg-gray-100 p-3">
        <div class="text-lg font-normal text-gray-500 uppercase mb-2">Assigned Conditions</div>
        <div v-if="assignedConditions.length > 0" class="flex flex-row flex-wrap justify-content-around align-content-center w-full font-semibold uppercase pr-6">
          <p>Field</p>
          <p>Condition</p>
          <p>Value</p>
        </div>
        <div
          v-if="assignedConditions.length == 0"
          class="flex flex-column align-items-center justify-content-center py-2 gap-2"
        >
          <div class="text-xl uppercase font-bold">No Conditions Added</div>
          <div class="text-sm uppercase text-gray-700">
            Assignment will be <PvTag severity="warning" class="mx-1">ASSIGNED</PvTag> to all {{ isLevante ? 'users' : 'students' }} in the
            administration.
          </div>
        </div>
        <!-- ASSIGNED CONDITIONS  -->
        <div v-for="(condtion, index) in assignedConditions" :key="index">
            <div class="flex gap-2 align-content-start flex-grow-0 params-container mb-2">
               <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.field" :options="computedFieldOptions" optionLabel="label" class="w-full" placeholder="Select a Field" inputId="Field"/>
              </div>

              <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.op" :options="computedConditionOptions(condtion.field)" optionLabel="label" class="w-full" placeholder="Condition" inputId="Condition"/>
              </div>

              <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.value" :options="computedValueOptions(condtion.field)" optionLabel="label" class="w-full" placeholder="Value"/>
              </div>

              <PvButton
                icon="pi pi-trash"
                text
                class="bg-primary text-white w-2 border-round border-none hover:bg-red-900"
                @click="removeCondition('assigned', index)"
              />
            </div>
        </div>

        <div class="flex flex-row-reverse justify-content-between align-items-center">
          <div class="mt-2 flex">
            <PvButton
              label="Add Condition"
              icon="pi pi-plus mr-2"
              class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
              data-cy="button-assigned-condition"
              @click="addAssignedCondition"
            />
          </div>
        </div>
      </div>
      <!-- OPTIONAL CONDITIONS -->
    <div >
      <div class="mt-2 flex flex-column gap-2">
        <div class="card p-fluid bg-gray-100 p-3">
          <div class="text-lg font-normal text-gray-500 uppercase mb-2">Optional Conditions</div>
          <div v-if="optionalConditions.length > 0" class="flex flex-row flex-wrap justify-content-around align-content-center w-full font-semibold uppercase pr-6">
            <p>Field</p>
            <p>Condition</p>
            <p>Value</p>
          </div>
          <div
            v-if="optionalConditions.length == 0"
            class="flex flex-column align-items-center justify-content-center py-2 gap-2"
          >
            <div class="text-xl uppercase font-bold">No Conditions Added</div>
            <div v-if="isOptionalForAll" class="text-sm uppercase text-gray-700">
              Assignment will be <PvTag severity="success" class="mx-1">OPTIONAL</PvTag> for all {{ isLevante ? 'users' : 'students' }} in the
              administration.
            </div>
            <div v-else class="text-sm uppercase text-gray-700">
              Assignment will <PvTag severity="danger" class="mx-1">NOT BE OPTIONAL</PvTag> for any {{ isLevante ? 'users' : 'students' }} in the
              administration.
            </div>
          </div>

          <div v-for="(condtion, index) in optionalConditions" :key="index">
            <div class="flex gap-2 align-content-start flex-grow-0 params-container mb-2">
               <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.field" :options="computedFieldOptions" optionLabel="label" class="w-full" placeholder="Select a Field" inputId="Field"/>
              </div>

              <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.op" :options="computedConditionOptions(condtion.field)" optionLabel="label" class="w-full" placeholder="Condition" inputId="Condition"/>
              </div>

              <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.value" :options="computedValueOptions(condtion.field)" optionLabel="label" class="w-full" placeholder="Value"/>
              </div>

              <PvButton
                icon="pi pi-trash"
                text
                class="bg-primary text-white w-2 border-round border-none hover:bg-red-900"
                @click="removeCondition('optional', index)"
              />
            </div>
        </div>

          <div class="flex flex-row justify-content-between align-items-center">
            <div class="flex flex-row justify-content-end align-items-center gap-2 mr-2">
              <div class="uppercase text-md font-bold text-gray-600">Make Assessment Optional For All {{ isLevante ? 'Users' : 'Students' }}</div>
              <PvInputSwitch
                v-model="isOptionalForAll"
                data-cy="switch-optional-for-everyone"
                @update:model-value="handleOptionalForAllSwitch"
              />
            </div>
            <div class="mt-2 flex gap-2">
              <PvButton
                label="AddCondition"
                icon="pi pi-plus mr-2"
                class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
                :disabled="isOptionalForAll === true"
                @click="addOptionalCondition"
                data-cy="button-optional-condition"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
      <PvDivider />
      <div class="flex flex-column align-items-center gap-1 mx-2">
        <div v-if="isOptionalForAllAndOptionalConditionsPresent" class="text-sm">
          <PvTag icon="pi pi-info-circle" severity="info">
            Making the assessment optional for all will override any optional conditions you have added.
          </PvTag>
        </div>
        <div v-if="errorSubmitText.length > 0" class="text-sm">
          <PvTag icon="pi pi-exclamation-triangle" severity="error" class="bg-transparent text-red-600">{{ errorSubmitText }}</PvTag>
        </div>
      </div>
      <div class="flex justify-content-center gap-2">
        <PvButton
          type="button"
          class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
          label="Reset"
          text
          severity="error"
          @click="handleReset"
        ></PvButton>
        <PvButton
          type="button"
          class="bg-primary text-white border-none border-round p-2 hover:bg-red-900"
          label="Save"
          data-cy="button-save-conditions"
          @click="handleSave"
        ></PvButton>
      </div>
    </div>
  </PvDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, toRaw, watch } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import _isEmpty from 'lodash/isEmpty';
import _cloneDeep from 'lodash/cloneDeep';
import { isLevante } from '@/helpers';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import PvDivider from 'primevue/divider';
import PvSelect from 'primevue/select';
import PvInputSwitch from 'primevue/inputswitch';
import PvTag from 'primevue/tag';
import type { VariantData, PreExistingAssessmentInfo, Condition, AssignmentConditions, OptionalConditions } from './VariantCard.vue';

interface SelectOption {
  label: string;
  value: string | number | boolean;
  project?: 'LEVANTE' | 'ROAR' | 'BOTH';
  type?: 'string' | 'number' | 'boolean';
}

interface ConditionInput {
  field: SelectOption | null;
  op: SelectOption | null;
  value: SelectOption | null;
}

interface Props {
  assessment: VariantData;
  updateVariant: (updatedVariant: VariantData) => void;
  preExistingAssessmentInfo?: PreExistingAssessmentInfo[];
}

const props = withDefaults(defineProps<Props>(), {
  preExistingAssessmentInfo: () => [],
});

export type { Props as EditVariantDialogProps };

const isVisible: Ref<boolean> = ref(false);
const assignedConditions: Ref<ConditionInput[]> = ref([]);
const optionalConditions: Ref<ConditionInput[]> = ref([]);
const previousOptionalConditions: Ref<ConditionInput[]> = ref([]);
const isOptionalForAll: Ref<boolean> = ref(false);
const errorSubmitText: Ref<string> = ref('');

const baseFieldOptions: SelectOption[] = [
  { label: 'Grade', value: 'grade', project: 'BOTH', type: 'string' },
  { label: 'User Type', value: 'userType', project: 'BOTH', type: 'string' },
];

const operatorOptionsMap: Record<string, SelectOption[]> = {
    string: [
        { label: 'Equal', value: 'EQUAL' },
        { label: 'Not Equal', value: 'NOT_EQUAL' },
    ],
    number: [
        { label: 'Equal', value: 'EQUAL' },
        { label: 'Not Equal', value: 'NOT_EQUAL' },
        { label: 'Greater Than', value: 'GREATER_THAN' },
        { label: 'Less Than', value: 'LESS_THAN' },
    ],
    boolean: [
        { label: 'Is', value: 'EQUAL' },
    ],
};

const valueOptionsMap: Record<string, SelectOption[]> = {
    grade: [
        { label: 'PK', value: 'PK' }, { label: 'TK', value: 'TK' },
        { label: 'K', value: 'K' }, { label: '1', value: '1' },
        { label: '2', value: '2' }, { label: '3', value: '3' },
        { label: '4', value: '4' }, { label: '5', value: '5' },
        { label: '6', value: '6' }, { label: '7', value: '7' },
        { label: '8', value: '8' }, { label: '9', value: '9' },
        { label: '10', value: '10' }, { label: '11', value: '11' },
        { label: '12', value: '12' },
    ],
    userType: [
        { label: 'Child', value: 'student' },
        { label: 'Parent', value: 'parent' },
        { label: 'Teacher', value: 'teacher' },
        { label: 'Administrator', value: 'administrator' },
    ],
};

const computedFieldOptions: ComputedRef<SelectOption[]> = computed(() => {
  const platform = isLevante ? 'LEVANTE' : 'ROAR';
  return baseFieldOptions.filter(opt => opt.project === 'BOTH' || opt.project === platform);
});

const computedConditionOptions = (fieldInput: ConditionInput['field']): SelectOption[] => {
    const field = toRaw(fieldInput);
    if (!field) return [];
    const fieldConfig = baseFieldOptions.find(opt => opt.value === field.value);
    return operatorOptionsMap[fieldConfig?.type || 'string'] || operatorOptionsMap['string'];
};

const computedValueOptions = (fieldInput: ConditionInput['field']): SelectOption[] => {
    const field = toRaw(fieldInput);
    if (!field) return [];
    return valueOptionsMap[field.value as string] || [];
};

const isOptionalForAllAndOptionalConditionsPresent: ComputedRef<boolean> = computed(() => {
    return isOptionalForAll.value && optionalConditions.value.length > 0;
});

const findOptionByValue = (options: SelectOption[], value: string | number | boolean | undefined): SelectOption | null => {
    return options.find(opt => opt.value === value) || null;
};

const convertToInputFormat = (conditions: Condition[] | undefined): ConditionInput[] => {
  if (!conditions) return [];
  return conditions.map(cond => {
    const fieldOption = findOptionByValue(baseFieldOptions, cond.field);
    const valueOption = findOptionByValue(valueOptionsMap[cond.field] || [], cond.value);
    const opOption = findOptionByValue(operatorOptionsMap[fieldOption?.type || 'string'] || [], cond.op);

    return {
      field: fieldOption,
      op: opOption,
      value: valueOption,
    };
  });
};

const convertToSaveFormat = (inputs: ConditionInput[]): Condition[] => {
  return inputs.filter(input => input.field && input.op && input.value)
        .map(input => ({
            field: input.field!.value as string,
            op: input.op!.value as string,
            value: input.value!.value,
        }));
};

const initializeConditions = (): void => {
    const assessmentConditions = props.assessment.variant.conditions;
    assignedConditions.value = convertToInputFormat(assessmentConditions?.assigned?.conditions);

    if (typeof assessmentConditions?.optional === 'boolean') {
        isOptionalForAll.value = assessmentConditions.optional;
        optionalConditions.value = [];
        previousOptionalConditions.value = [];
    } else {
        isOptionalForAll.value = false;
        optionalConditions.value = convertToInputFormat(assessmentConditions?.optional?.conditions);
        previousOptionalConditions.value = _cloneDeep(optionalConditions.value);
    }

    if (isLevante && props.assessment.task.id !== 'survey') {
        const hasUserTypeStudent = assignedConditions.value.some(cond =>
            cond.field?.value === 'userType' && cond.value?.value === 'student'
        );
        if (!hasUserTypeStudent) {
            assignedConditions.value.push({
                field: findOptionByValue(baseFieldOptions, 'userType'),
                op: findOptionByValue(operatorOptionsMap.string, 'EQUAL'),
                value: findOptionByValue(valueOptionsMap.userType, 'student'),
            });
        }
    }
};

const handleOptionalForAllSwitch = (value: boolean): void => {
    isOptionalForAll.value = value;
    if (value) {
        previousOptionalConditions.value = _cloneDeep(optionalConditions.value);
        optionalConditions.value = [];
    } else {
        optionalConditions.value = _cloneDeep(previousOptionalConditions.value);
    }
    errorSubmitText.value = '';
};

const addAssignedCondition = (): void => {
    assignedConditions.value.push({ field: null, op: null, value: null });
    errorSubmitText.value = '';
};

const addOptionalCondition = (): void => {
    if (isOptionalForAll.value) return;
    optionalConditions.value.push({ field: null, op: null, value: null });
    errorSubmitText.value = '';
};

const removeCondition = (listType: 'assigned' | 'optional', index: number): void => {
    if (listType === 'assigned') {
        assignedConditions.value.splice(index, 1);
    } else if (listType === 'optional') {
        optionalConditions.value.splice(index, 1);
    }
    errorSubmitText.value = '';
};

const handleReset = (): void => {
    initializeConditions();
    errorSubmitText.value = '';
};

const handleSave = (): void => {
    errorSubmitText.value = '';

    const allInputs = [...assignedConditions.value, ...optionalConditions.value];
    const incompleteCondition = allInputs.some(input => !input.field || !input.op || !input.value);

    if (incompleteCondition) {
        errorSubmitText.value = 'Please complete all fields for each condition before saving.';
        return;
    }

    const updatedAssessment = _cloneDeep(props.assessment);
    if (!updatedAssessment.variant.conditions) {
        updatedAssessment.variant.conditions = {};
    }

    const finalAssignedConditions = convertToSaveFormat(assignedConditions.value);
    if (finalAssignedConditions.length > 0) {
        updatedAssessment.variant.conditions.assigned = {
            conjunction: 'AND',
            conditions: finalAssignedConditions,
        };
    } else {
        delete updatedAssessment.variant.conditions.assigned;
    }

    if (isOptionalForAll.value) {
        updatedAssessment.variant.conditions.optional = true;
    } else {
        const finalOptionalConditions = convertToSaveFormat(optionalConditions.value);
        if (finalOptionalConditions.length > 0) {
            updatedAssessment.variant.conditions.optional = {
                conjunction: 'AND',
                conditions: finalOptionalConditions,
            };
        } else {
            delete updatedAssessment.variant.conditions.optional;
        }
    }

    if (_isEmpty(updatedAssessment.variant.conditions)) {
        delete updatedAssessment.variant.conditions;
    }

    props.updateVariant(updatedAssessment);
    isVisible.value = false;
};

onMounted(() => {
    initializeConditions();
});

watch(() => props.assessment, () => {
    initializeConditions();
}, { deep: true });
</script>
