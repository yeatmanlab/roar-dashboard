import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parse, stringify } from 'zipson';

export const useAssignmentsStore = defineStore(
  'assignmentsStore',
  () => {
    // state
    const selectedAssignment = ref(null);
    const selectedStatus = ref('');
    const requireRefresh = ref(false);

    // actions
    function setSelectedAssignment(assignment) {
      selectedAssignment.value = assignment;
    }
    function setSelectedStatus(status) {
      selectedStatus.value = status;
    }

    function setHomeRefresh() {
      requireRefresh.value = true;
    }

    function $reset() {
      selectedAssignment.value = null;
      selectedStatus.value = '';
      requireRefresh.value = false;
    }

    return {
      // state
      selectedAssignment,
      selectedStatus,
      requireRefresh,
      // actions
      setSelectedAssignment,
      setSelectedStatus,
      setHomeRefresh,
      $reset,
    };
  },
  {
    persist: {
      storage: sessionStorage,
      serialize: {
        deserialize: parse,
        serialize: stringify,
      },
    },
  },
);
