<template>
  <div>
    <StepNavigation
      title="Organizations"
      :previous-step="REGISTRATION_STEPS.OTHER"
      :next-step="REGISTRATION_STEPS.PREVIEW"
      :disabled="!readyToProgress"
      @previous="$emit('activate', $event)"
      @next="$emit('activate', $event)"
    />
    <div class="step-container">
      <div class="w-full">
        <div class="flex flex-column gap-4">
          <div class="flex align-items-center">
            <PvCheckbox
              v-model="localUsingOrgPicker"
              :binary="true"
              input-id="usingOrgPicker"
              @change="$emit('update:using-org-picker', localUsingOrgPicker)"
            />
            <label for="usingOrgPicker" class="ml-2">Use Organization Picker</label>
          </div>

          <div v-if="localUsingOrgPicker" class="flex flex-column gap-2">
            <h3>Select Organizations</h3>
            <OrgPicker @selection="orgSelection" />
            <div class="flex flex-column gap-2 mt-2">
              <div v-if="!eduOrgsSelected && !nonEduOrgsSelected" class="text-red-500">
                Please select at least one organization
              </div>
              <div v-else-if="eduOrgsSelected" class="text-green-500">Educational organizations selected</div>
              <div v-else-if="nonEduOrgsSelected" class="text-green-500">Non-educational organizations selected</div>
            </div>
          </div>

          <div v-else class="flex flex-column gap-2">
            <h3>Organization Fields</h3>
            <div class="flex flex-column gap-2">
              <div class="flex flex-column gap-1">
                <label for="districts">Districts</label>
                <PvDropdown
                  id="districts"
                  v-model="localMappedColumns.organizations.districts"
                  :options="csvColumns"
                  option-label="header"
                  option-value="field"
                  placeholder="Select a column"
                  class="w-full"
                  @change="updateMapping(FIELD_TYPES.ORGANIZATIONS, 'districts', $event.value)"
                />
                <small>The district the student belongs to</small>
              </div>

              <div class="flex flex-column gap-1">
                <label for="schools">Schools</label>
                <PvDropdown
                  id="schools"
                  v-model="localMappedColumns.organizations.schools"
                  :options="csvColumns"
                  option-label="header"
                  option-value="field"
                  placeholder="Select a column"
                  class="w-full"
                  @change="updateMapping(FIELD_TYPES.ORGANIZATIONS, 'schools', $event.value)"
                />
                <small>The school the student belongs to</small>
              </div>

              <div class="flex flex-column gap-1">
                <label for="groups">Groups</label>
                <PvDropdown
                  id="groups"
                  v-model="localMappedColumns.organizations.groups"
                  :options="csvColumns"
                  option-label="header"
                  option-value="field"
                  placeholder="Select a column"
                  class="w-full"
                  @change="updateMapping(FIELD_TYPES.ORGANIZATIONS, 'groups', $event.value)"
                />
                <small>The group the student belongs to</small>
              </div>
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
import OrgPicker from '@/components/OrgPicker.vue';
import { REGISTRATION_STEPS, FIELD_TYPES } from '@/constants/studentRegistration';
import StepNavigation from '../common/StepNavigation.vue';

const props = defineProps({
  usingOrgPicker: {
    type: Boolean,
    default: true,
  },
  mappedColumns: {
    type: Object,
    required: true,
  },
  csvColumns: {
    type: Array,
    required: true,
  },
  eduOrgsSelected: {
    type: Boolean,
    default: false,
  },
  nonEduOrgsSelected: {
    type: Boolean,
    default: false,
  },
  readyToProgress: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:using-org-picker', 'update:mapped-columns', 'org-selection', 'activate']);

const localUsingOrgPicker = ref(props.usingOrgPicker);
const localMappedColumns = ref(props.mappedColumns);

// Watch for changes in props
watch(
  () => props.usingOrgPicker,
  (newValue) => {
    localUsingOrgPicker.value = newValue;
  },
);

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

function orgSelection(orgs) {
  emit('org-selection', orgs);
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
