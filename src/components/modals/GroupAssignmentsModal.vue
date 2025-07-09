<template>
  <PvDialog
    v-model:visible="modalVisible"
    modal
    :style="{ width: '50rem', padding: '0.8rem' }"
    :draggable="false"
    class="group-assignments-modal"
  >
    <template #header>
      <h2 class="m-0">Assignments for: <b>{{ orgName }}</b></h2>
    </template>

    <div v-if="isLoading" class="flex justify-content-center p-4">
      <AppSpinner />
    </div>

    <div v-else-if="assignments.length === 0" class="flex flex-column align-items-center justify-content-center py-8">
      <h3 class="text-xl font-bold mb-4">No Assignments</h3>
      <p class="text-center text-gray-500">This group has no assignments yet.</p>
    </div>

    <div v-else class="assignments-list">
      <div
        v-for="assignment in assignments"
        :key="assignment.id"
        class="assignment-card p-4 mb-3 surface-100 border-round"
      >
        <div class="assignment-header">
          <h3 class="assignment-title m-0 mb-2">{{ assignment.name || assignment.publicName }}</h3>
          <small v-if="assignment.creator?.displayName" class="m-0 ml-1 text-gray-600">
            — Created by <span class="font-bold">{{ assignment.creator.displayName }}</span>
          </small>
        </div>
        
        <div class="assignment-details">
          <span class="mr-1"><strong>Availability</strong>:</span>
          <span v-if="assignment.dates">
            {{ formatDate(assignment.dates.start) }} — {{ formatDate(assignment.dates.end) }}
          </span>
          <span v-else class="text-gray-500">No dates set</span>
          <span :class="['status-badge', getStatusBadgeClass(assignment)]">
            {{ getAssignmentStatus(assignment) }}
          </span>
        </div>
        
        <div class="assignment-tasks">
          <span class="mr-1"><strong>Tasks</strong>:</span>
          <span class="text-gray-600">{{ assignment.assessments?.length || 0 }} tasks</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-content-end">
        <PvButton
          label="Close"
          class="bg-primary border-none text-white"
          @click="closeModal"
        />
      </div>
    </template>
  </PvDialog>
</template>

<script setup>
import { computed, watch } from 'vue';
import PvDialog from 'primevue/dialog';
import PvButton from 'primevue/button';
import AppSpinner from '@/components/AppSpinner.vue';
import { getAdministrationsByOrg } from '@/helpers/query/administrations';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false,
  },
  orgId: {
    type: String,
    default: '',
  },
  orgName: {
    type: String,
    default: '',
  },
  orgType: {
    type: String,
    default: 'groups',
  },
  allAdministrations: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close']);

const modalVisible = computed({
  get: () => props.isVisible,
  set: (value) => {
    if (!value) {
      emit('close');
    }
  },
});

const assignments = computed(() => {
  if (!props.orgId || !props.allAdministrations) {
    return [];
  }
  return getAdministrationsByOrg(props.orgId, props.orgType, props.allAdministrations);
});

const formatDate = (date) => {
  if (!date) return 'No date';
  return new Date(date).toLocaleDateString();
};

const getAssignmentStatus = (assignment) => {
  if (!assignment.dates?.end) return 'NO DATES';
  
  const now = new Date();
  const endDate = new Date(assignment.dates.end);
  
  return now > endDate ? 'CLOSED' : 'OPEN';
};

const getStatusBadgeClass = (assignment) => {
  const status = getAssignmentStatus(assignment);
  return status.toLowerCase();
};

const closeModal = () => {
  emit('close');
};

// Watch for changes in isVisible to reset state when modal closes
watch(() => props.isVisible, (newValue) => {
  if (!newValue) {
    // Modal is closing, could add cleanup logic here if needed
  }
});
</script>

<style lang="scss" scoped>
.group-assignments-modal {
  .assignments-list {
    max-height: 60vh;
    overflow-y: auto;
  }

  .assignment-card {
    transition: all 0.2s ease;
    border: 1px solid var(--gray-200);
    border-radius: calc(var(--border-radius) * 4);
    
    &:hover {
      background-color: var(--surface-200) !important;
      border-color: var(--gray-300);
    }
  }

  .assignment-header {
    margin-bottom: 1rem;
  }

  .assignment-title {
    font-weight: bold;
    font-size: 1.1rem;
    color: var(--text-color);
  }

  .assignment-details {
    display: flex;
    justify-content: start;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .assignment-tasks {
    margin-top: 0.5rem;
  }

  .status-badge {
    font-weight: bold;
    font-family: var(--font-family);
    padding: 0.25rem 0.5rem;
    border-radius: var(--p-border-radius-xl);
    font-size: 0.7rem;
    margin: 0 0 0 0.8rem;

    &.open {
      background-color: var(--green-100);
      color: var(--green-800);
    }

    &.closed {
      background-color: var(--gray-300);
      color: var(--red-900);
    }

    &.no-dates {
      background-color: var(--yellow-100);
      color: var(--yellow-800);
    }
  }
}
</style> 