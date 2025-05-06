<template>
  <div>
    <StepNavigation
      title="Required Fields"
      :previous-step="REGISTRATION_STEPS.UPLOAD"
      :next-step="REGISTRATION_STEPS.NAMES"
      :disabled="!readyToProgress"
      @previous="$emit('activate', $event)"
      @next="$emit('activate', $event)"
    />
    <div class="step-container">
      <div class="w-full">
        <div class="flex flex-column gap-4">
          <div class="flex align-items-center">
            <PvCheckbox
              v-model="localUsingEmail"
              :binary="true"
              input-id="usingEmail"
              @change="$emit('update:using-email', localUsingEmail)"
            />
            <label for="usingEmail" class="ml-2">Use Email for Authentication</label>
          </div>

          <div class="flex flex-column gap-2">
            <h3>Required Fields</h3>
            <div v-for="field in requiredFields" :key="field.field" class="flex flex-column gap-1">
              <label :for="field.field">{{ field.label }}</label>
              <PvDropdown
                :id="field.field"
                v-model="localMappedColumns.required[field.field]"
                :options="csvColumns"
                option-label="header"
                option-value="field"
                placeholder="Select a column"
                class="w-full"
                @change="updateMapping(FIELD_TYPES.REQUIRED, field.field, $event.value)"
              />
              <small>{{ field.description }}</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue';
import PvDropdown from 'primevue/dropdown';
import PvCheckbox from 'primevue/checkbox';
import { REGISTRATION_STEPS, FIELD_TYPES } from '@/constants/studentRegistration';
import StepNavigation from '../common/StepNavigation.vue';

const props = defineProps({
  usingEmail: {
    type: Boolean,
    default: false,
  },
  mappedColumns: {
    type: Object,
    required: true,
  },
  csvColumns: {
    type: Array,
    required: true,
  },
  readyToProgress: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:using-email', 'update:mapped-columns', 'activate']);

const localUsingEmail = ref(props.usingEmail);
const localMappedColumns = ref(props.mappedColumns);

// Watch for changes in props
watch(
  () => props.usingEmail,
  (newValue) => {
    localUsingEmail.value = newValue;
  },
);

watch(
  () => props.mappedColumns,
  (newValue) => {
    localMappedColumns.value = newValue;
  },
  { deep: true },
);

// Required fields based on authentication method
const requiredFields = [
  {
    label: 'Username',
    description: 'The username for the student account',
    field: 'username',
    show: () => !localUsingEmail.value,
  },
  {
    label: 'Email',
    description: 'The email for the student account',
    field: 'email',
    show: () => localUsingEmail.value,
  },
  {
    label: 'Password',
    description: 'The password for the student account',
    field: 'password',
    show: () => true,
  },
  {
    label: 'Grade',
    description: 'The grade level of the student',
    field: 'grade',
    show: () => true,
  },
  {
    label: 'Date of Birth',
    description: 'The date of birth of the student (YYYY-MM-DD)',
    field: 'dob',
    show: () => true,
  },
];

function updateMapping(category, field, value) {
  emit('update:mapped-columns', category, field, value);
}
</script>

<style scoped>
.step-container {
  width: 100%;
  height: 100%;
  display: flex;
  padding: 0 2rem;
}
</style>
