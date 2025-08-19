import { defineStore } from 'pinia';

export const useAssignmentsStore = defineStore('assignmentsStore', {
  state: () => ({
    selectedAssignment: null,
    selectedStatus: '',
  }),
  actions: {
    setSelectedAssignment(assignment) {
      this.selectedAssignment = assignment;
    },
    setSelectedStatus(status) {
      this.selectedStatus = status;
    },
  },
  persist: {
    storage: sessionStorage,
    paths: ['selectedAssignment', 'selectedStatus'],
  },
});
