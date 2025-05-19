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
            {{ assessment.task.name }}
          </div>
        </div>
        <div v-if="assessment.variant?.name" class="gap-2">
          <div class="text-sm font-light uppercase text-gray-500">Variant Name</div>
          <div class="text-xl">
            {{ assessment.variant?.name }}
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
            Assignment will be <PvTag severity="warning" class="mx-1">ASSIGNED</PvTag> to all {{ isLevante ? 'users' : 'participants' }} in the
            {{ selectedGroup }}
          </div>
        </div>
        <!-- ASSIGNED CONDITIONS  -->
        <div v-for="(condtion, index) in assignedConditions" :key="index">
            <div class="flex gap-2 align-content-start flex-grow-0 params-container mb-2">
               <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.field" :options="fieldOptions" optionLabel="label" class="w-full" placeholder="Select a Field" inputId="Field"/>
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
                @click="removeCondition(assignedConditions, index)"
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
              Assignment will be <PvTag severity="success" class="mx-1">OPTIONAL</PvTag> for all {{ isLevante ? 'users' : 'participants' }} in the
              {{ selectedGroup }}
            </div>
            <div v-else class="text-sm uppercase text-gray-700">
              Assignment will <PvTag severity="danger" class="mx-1">NOT BE OPTIONAL</PvTag> for any {{ isLevante ? 'users' : 'participants' }} in the
              {{ selectedGroup }}
            </div>
          </div>

          <div v-for="(condtion, index) in optionalConditions" :key="index">
            <div class="flex gap-2 align-content-start flex-grow-0 params-container mb-2">
               <div class="flex flex-row flex-wrap justify-content-between align-content-center gap-2 w-full">
                <PvSelect v-model="condtion.field" :options="fieldOptions" optionLabel="label" class="w-full" placeholder="Select a Field" inputId="Field"/>
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
                @click="removeCondition(optionalConditions, index)"
              />
            </div>
        </div>

          <div class="flex flex-row justify-content-between align-items-center">
            <div class="flex flex-row justify-content-end align-items-center gap-2 mr-2">
              <div class="uppercase text-md font-bold text-gray-600">Make Assessment Optional For All {{ isLevante ? 'Users' : 'Participants' }}</div>
              <PvToggleSwitch
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
                data-cy="button-optional-condition"
                @click="addOptionalCondition"
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

<script setup>
import { ref, onMounted, computed, toRaw } from 'vue';
import _isEmpty from 'lodash/isEmpty';
import _cloneDeep from 'lodash/cloneDeep';
import { isLevante } from '@/helpers';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import PvDivider from 'primevue/divider';
import PvSelect from 'primevue/select';
import PvToggleSwitch from 'primevue/toggleswitch';
import PvTag from 'primevue/tag';
import PvColumn from 'primevue/column';

const props = defineProps({
  assessment: {
    type: Object,
    required: true,
  },
  updateVariant: {
    type: Function,
    required: true,
  },
  preExistingAssessmentInfo: {
    type: Array,
    default: () => [],
  },
});


onMounted(() => {
  getAllConditions(props.assessment.task.id);
  // LEVANTE assigns surveys as assessments, so we add a defualt for child only so researchers
  // do not accidently assign tasks to parents and teachers
  if (isLevante && props.assessment.task.id !== 'survey') {
    assignedConditions.value.push({ 
      field: { label: 'User Type', value: 'userType', project: 'LEVANTE' },
      op: { label: 'Equal', value: 'EQUAL' },
      value: { label: 'Child', value: 'student' },
    });
  }
});

const isVisible = ref(false);
const assignedConditions = ref([]);
const optionalConditions = ref([]);
// Store optional conditions in case the isOptionalForAll is toggled on and off again (prevents the form from resetting to the original state)
const previousOptionalConditions = ref([]);

const computedValueOptions = (field) => {
  const processedField = toRaw(field);
  if (!processedField) return 
  const selectedField = processedField.label;

  if (selectedField === 'Age') {
    return [
      { label: '3', value: '3' },
      { label: '4', value: '4' },
      { label: '5', value: '5' },
      { label: '6', value: '6' },
      { label: '7', value: '7' },
      { label: '8', value: '8' },
      { label: '9', value: '9' },
      { label: '10', value: '10' },
      { label: '11', value: '11' },
      { label: '12', value: '12' },
    ];
  } else if (selectedField === 'User Type') {
    return [
      { label: 'Child', value: 'student' },
      { label: 'Caregiver', value: 'parent' },
      { label: 'Teacher', value: 'teacher' },
    ];
  }
}

const computedConditionOptions = (field) => {
  const processedField = toRaw(field);
  if (!processedField) return 
  const selectedField = processedField.label;
  
  if (selectedField === 'Age') {
    return [
      { label: 'Less Than', value: 'LESS_THAN' },
      { label: 'Greater Than', value: 'GREATER_THAN' },
      { label: 'Less Than or Equal', value: 'LESS_THAN_OR_EQUAL' },
      { label: 'Greater Than or Equal', value: 'GREATER_THAN_OR_EQUAL' },
      { label: 'Equal', value: 'EQUAL' },
      { label: 'Not Equal', value: 'NOT_EQUAL' },
    ];
  } else if (selectedField === 'User Type') {
    return [
      { label: 'Equal', value: 'EQUAL' },
      { label: 'Not Equal', value: 'NOT_EQUAL' },
    ];
  }
}


const removeCondition = (condtions, index) => {
  condtions.splice(index, 1);
};


function getAllConditions(taskId) {
  const existingAssignedConditions = getAssignedConditions(taskId);
  const existingOptionalConditions = getOptionalConditions(taskId);

  setAssignedConditions(existingAssignedConditions);
  setOptionalConditions(existingOptionalConditions);
}

// Get the assigned and optional conditions from the pre-existing admin info
function getAssignedConditions(taskId) {
  return props.preExistingAssessmentInfo
          .find((assessment) => assessment.taskId === taskId)
          ?.conditions?.assigned?.conditions;
}

function getOptionalConditions(taskId) {
  const task = props.preExistingAssessmentInfo.find((assessment) => assessment.taskId === taskId);
  const hasOptionalConditions = task?.conditions?.optional?.conditions;

  if (hasOptionalConditions) {
    isOptionalForAll.value = false;
    return hasOptionalConditions;
  } else {
    isOptionalForAll.value = !!task?.conditions?.optional;
    return [];
  }
}

// Set the assigned and optional conditions from the pre-existing admin info
function setAssignedConditions(existingAssignedConditions) {
  if (!existingAssignedConditions) return;
  for (const condition of existingAssignedConditions) {
    assignedConditions.value = [condition, ...assignedConditions.value];
  }
}

function setOptionalConditions(existingOptionalConditions) {
  if (!existingOptionalConditions) return;
  for (const condition of existingOptionalConditions) {
    optionalConditions.value = [condition, ...optionalConditions.value];
  }
};

const addOptionalCondition = () => {
  optionalConditions.value.push({ field: '', op: '', value: '' });
};

const addAssignedCondition = () => {
  assignedConditions.value.push({ field: '', op: '', value: '' });
};

const isOptionalForAll = ref(false);
const errorSubmitText = ref('');

const handleOptionalForAllSwitch = () => {
  if (isOptionalForAll.value === true) {
    // Store the optional conditions in case the isOptionalForAll is toggled on and off again
    previousOptionalConditions.value = optionalConditions.value;
    optionalConditions.value = [];
  } else {
    optionalConditions.value = previousOptionalConditions.value;
  }
};

const isOptionalForAllAndOptionalConditionsPresent = computed(() => {
  return isOptionalForAll.value && toRaw(previousOptionalConditions.value)?.length > 0;
});

const handleReset = () => {
  errorSubmitText.value = '';
  assignedConditions.value = [];
  optionalConditions.value = [];

  getAllConditions(props.assessment.task.id);
};

const handleSave = () => {
  let error = false;

  // Check if any emppty fields in Assigned Conditions
  for (const condition of assignedConditions.value) {
    for (const [key, value] of Object.entries(condition)) {
      if (value == '') {
          errorSubmitText.value = 'Missing fields in Assigned Conditions';
          error = true;
      }
    }
  }

  // Check if any emppty fields in Optional Conditions
  for (const condition of optionalConditions.value) {
    for (const [key, value] of Object.entries(condition)) {
      if (value == '') {
        errorSubmitText.value = 'Missing fields in Optional Conditions';
        error = true;
      }
    }
  }

  if (!error) {
    errorSubmitText.value = '';
    // If isOptionalForAll is true, then overwrite optional conditions by setting optional to true
    const [assignedConditionsToValues, optionalConditionsToValues] = conditionsToValues()
    const conditionsCopy = computedConditions(assignedConditionsToValues, optionalConditionsToValues);

    if (isOptionalForAll.value === true) {
      conditionsCopy['optional'] = true;
    }

    props.updateVariant(props.assessment.id, conditionsCopy);
    isVisible.value = false;
  }

  return;
};

// Conditions hold the object of the form { field: { lable: 'Grade', value: 'studentData.grade', project: ALL }, etc }
// We need to convert the conditions to the form { field: 'studnetData.grade', etc }
function conditionsToValues() {
  const assignedConditionsCopy = _cloneDeep(assignedConditions.value);
  const optionalConditionsCopy = _cloneDeep(optionalConditions.value);

  assignedConditionsCopy.forEach((condition) => {
    for (const [key, value] of Object.entries(condition)) {
        condition[key] = condition[key] = value.value;
      }
  });

  optionalConditionsCopy.forEach((condition) => {
    for (const [key, value] of Object.entries(condition)) {          
        condition[key] = condition[key] = value.value;  
      }
  });

  return [assignedConditionsCopy, optionalConditionsCopy];
}

const computedConditions = (assignedConditions, optionalConditions) => {
  const conditions = {};

  if (!_isEmpty(optionalConditions)) {
    conditions.optional = { op: 'AND', conditions: optionalConditions };
  }

  if (!_isEmpty(assignedConditions)) {
    conditions.assigned = { op: 'AND', conditions: assignedConditions };
  }

  return conditions;
};


const fieldOptions = [
  { label: 'User Type', value: 'userType', project: 'LEVANTE' },
  { label: 'Age', value: 'age', project: 'LEVANTE' },
];
</script>
