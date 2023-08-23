import { defineStore, storeToRefs } from "pinia";
import { getTreeTableOrgs } from "@bdelab/roar-firekit";
import { useAuthStore } from "@/store/auth"

export const useQueryStore = () => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  return defineStore({
    id: "queryStore",
    state: () => {
      return {
        allVariants: [],
        adminOrgs: {},
        hierarchicalAdminOrgs: {},
        administrations: [],
      };
    },
    actions: {
      async getMyAdministrations() {
        if (roarfirekit.value?.app?.db) {
          const administrations = await roarfirekit.value.getMyAdministrations();
          this.administrations =  administrations.map((administration) => ({
            ...administration,
            dates: {
              start: administration.dateOpened.toDate(),
              end: administration.dateClosed.toDate(),
            },
            assignedOrgs: {
              districts: administration.districts,
              schools: administration.schools,
              classes: administration.classes,
              groups: administration.groups,
              families: administration.families,
            }
          }));
        } else {
          this.administrations = [];
        }
      },
      async getOrgs(orgType) {
        if (roarfirekit.value?.app?.db) {
          return roarfirekit.value.getOrgs(orgType);
        } else {
          return []
        }
      },
      async getAdminOrgs() {
        const promises = [
          this.getOrgs("districts"),
          this.getOrgs("schools"),
          this.getOrgs("classes"),
          this.getOrgs("groups"),
          this.getOrgs("families"),
        ]
      
        const [_districts, _schools, _classes, _groups, _families] = await Promise.all(promises);
        this.adminOrgs = {
          districts: _districts,
          schools: _schools,
          classes: _classes,
          groups: _groups,
          families: _families,
        }

        this.hierarchicalAdminOrgs = getTreeTableOrgs(this.adminOrgs);
      },
      getTreeTableOrgs(orgs) {
        return getTreeTableOrgs(orgs);
      },
      async getTasks(requireRegistered = true) {
        this.tasksReady = false;
        if (roarfirekit.value?.app?.db) {
          this.tasks = await roarfirekit.value.getTasks(requireRegistered)
        } else {
          this.tasks = []
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
  })();
};
