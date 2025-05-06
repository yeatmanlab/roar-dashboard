<template>
  <div>
    <StepNavigation
      title="Other Fields"
      :previous-step="REGISTRATION_STEPS.DEMOGRAPHICS"
      :next-step="REGISTRATION_STEPS.ORGANIZATIONS"
      @previous="$emit('activate', $event)"
      @next="$emit('activate', $event)"
    />
    <div class="step-container">
      <div class="w-full">
        <div class="flex flex-column gap-4">
          <div class="flex flex-column gap-2">
            <h3>Optional Fields</h3>
            <div v-for="(field, key) in optionalFields" :key="key" class="flex flex-column gap-1">
              <label :for="key">{{ field.label }}</label>
              <PvDropdown
                :id="key"
                v-model="localMappedColumns.optional[key]"
                :options="csvColumns"
                option-label="header"
                option-value="field"
                placeholder="Select a column"
                class="w-full"
                @change="updateMapping(FIELD_TYPES.OPTIONAL, key, $event.value)"
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
import { REGISTRATION_STEPS, FIELD_TYPES } from '@/constants/studentRegistration';
import StepNavigation from '../common/StepNavigation.vue';

const props = defineProps({
  optionalFields: {
    type: Object,
    required: true,
  },
  mappedColumns: {
    type: Object,
    required: true,
  },
  csvColumns: {
    type: Array,
    required: true,
  },
  userCan: {
    type: Function,
    default: () => false,
  },
});

const emit = defineEmits(['update:mapped-columns', 'activate']);

const localMappedColumns = ref(props.mappedColumns);

// Watch for changes in props
watch(
  () => props.mappedColumns,
  (newValue) => {
    localMappedColumns.value = newValue;
  },
  { deep: true },
);

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
