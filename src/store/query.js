import { defineStore, storeToRefs } from 'pinia';
import { parse, stringify } from 'zipson';
import { useAuthStore } from '@/store/auth';

export const useQueryStore = () => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  return defineStore({
    id: 'queryStore',
    state: () => {
      return {
        allVariants: [],
        adminOrgs: {},
        administrations: [],
        users: {},
        assignmentData: {},
        administrationInfo: {},
        orgInfo: {},
        scoresData: {},
      };
    },
    actions: {
      async getTasks(requireRegistered = true) {
        this.tasksReady = false;
        if (roarfirekit.value?.app?.db) {
          this.tasks = await roarfirekit.value.getTasks(requireRegistered);
        } else {
          this.tasks = [];
        }
        this.tasksReady = true;
      },
      async getVariants(requireRegistered = true) {
        this.variantsReady = false;
        if (roarfirekit.value?.app?.db) {
          this.allVariants = await roarfirekit.value.getVariants(requireRegistered);
        } else {
          this.allVariants = [];
        }
        this.variantsReady = true;
      },
    },
    persist: {
      storage: sessionStorage,
      debug: false,
      serializer: {
        deserialize: parse,
        serialize: stringify,
      },
    },
  })();
};
