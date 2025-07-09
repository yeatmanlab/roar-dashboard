<template>
  <PvDialog
    v-model:visible="modalVisible"
    modal
    :style="{ width: '50rem', padding: '0.8rem' }"
    :draggable="false"
    class="group-assignments-modal"
  >
    <template #header>
      <h2 class="m-0">
        Assignments for: <b>{{ orgName }}</b>
      </h2>
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
        class="assignment-item p-3 mb-2 surface-100 border-round"
      >
        <div class="flex justify-content-between align-items-start">
          <h3 class="assignment-title m-0">{{ assignment.name || assignment.publicName }}</h3>
          <small v-if="assignment.creator?.displayName" class="m-0 text-gray-600">
            Created by <span class="font-bold">{{ assignment.creator.displayName }}</span>
          </small>
        </div>
      </div>
    </div>
  </PvDialog>
</template>

<script setup>
import { computed, watch } from 'vue';
import PvDialog from 'primevue/dialog';
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

watch(
  () => props.isVisible,
  (newValue) => {
    if (!newValue) {
      emit('close');
    }
  },
);
</script>

<style lang="scss" scoped>
.group-assignments-modal {
  .assignments-list {
    max-height: 59vh;
    overflow-y: auto;
    padding: 0 1rem 0 0;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: var(--surface-100);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--surface-300);
      border-radius: 4px;

      &:hover {
        background: var(--surface-400);
      }
    }
  }

  .assignment-item {
    border: 1px solid var(--gray-200);
    border-radius: calc(var(--border-radius) * 4);
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--gray-300);
      background-color: var(--surface-50);
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .assignment-title {
    font-weight: bold;
    font-size: 1rem;
    color: var(--text-color);
  }
}
</style>
