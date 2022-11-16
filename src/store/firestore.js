import { defineStore } from "pinia";
import { query, getDocs, collection, collectionGroup } from "@firebase/firestore";
import { db } from "../firebaseInit.js";

export const useFireStore = () => {
  return defineStore({
    id: "fireStore",
    state: () => {
      return {
        tasks: [],
        roarUids: [],
        districts: [],
        schools: [],
        classes: [],
        studies: [],
        dbCollections: [],
        runs: [],
        selectedTasks: [],
        selectedRoarUids: [],
        startDate: null,
        endDate: null,
        selectedDistricts: [],
        selectedSchools: [],
        selectedClasses: [],
        selectedStudies: [],
        selectedDbCollections: [],
      };
    },
    getters: {},
    actions: {
      async retrieveTasks() {
        const taskQuery = query(collectionGroup(db, 'tasks'));
        const tasksSnapshot = await getDocs(taskQuery);
        const tasks = [];

        tasksSnapshot.forEach(async (doc) => {
          const variantQuery = query(collection(doc.ref, 'variants'));
          const variantsSnapshot = await getDocs(variantQuery);
          variantsSnapshot.forEach((variantDoc) => {
            tasks[doc.id].push({
              taskId: doc.id,
              taskName: doc.data().name,
              variantId: variantDoc.id,
              variantName: variantDoc.data().name,
            })
          });
        });

        this.tasks = tasks;
      },
    },
  })();
};
