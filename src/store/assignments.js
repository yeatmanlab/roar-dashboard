import { defineStore } from 'pinia';

export const useAssignmentsStore = defineStore('assignmentsStore', {
  state: () => ({
    assignments: [],
    selectedAssignment: null,
    selectedStatus: '',
  }),
  getters: {
    //
  },
  actions: {
    setAssignments(assignments) {
      this.assignments = assignments;
    },
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
