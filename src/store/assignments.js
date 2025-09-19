import { defineStore } from 'pinia';
import { ref } from 'vue';
import { parse, stringify } from 'zipson';

export const useAssignmentsStore = defineStore(
  'assignmentsStore',
  () => {
    // state
    const requireRefresh = ref(false);
    const selectedAssignment = ref(null);
    const selectedStatus = ref('');
    const userAssignments = ref([]);

    // actions
    function $reset() {
      requireRefresh.value = false;
      selectedAssignment.value = null;
      selectedStatus.value = '';
      userAssignments.value = [];
    }

    function setHomeRefresh() {
      requireRefresh.value = true;
    }

    function setSelectedAssignment(assignment) {
      selectedAssignment.value = assignment;
    }

    function setSelectedStatus(status) {
      selectedStatus.value = status;
    }

    function setUserAssignments(assignments) {
      userAssignments.value = assignments;
    }

    return {
      // state
      requireRefresh,
      selectedAssignment,
      selectedStatus,
      userAssignments,
      // actions
      $reset,
      setHomeRefresh,
      setSelectedAssignment,
      setSelectedStatus,
      setUserAssignments,
    };
  },
  {
    persist: {
      serialize: {
        deserialize: parse,
        serialize: stringify,
      },
      storage: sessionStorage,
    },
  },
);
