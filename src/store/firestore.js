import { defineStore } from "pinia";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
} from "@firebase/firestore";
import { db } from "../firebaseInit.js";

export const useFireStore = () => {
  return defineStore({
    id: "fireStore",
    state: () => {
      return {
        tasks: [],
        tasksReady: false,
        variants: [],
        variantsReady: false,
        roarUids: [],
        districts: [],
        schools: [],
        classes: [],
        studies: [],
        rootDocs: {},
        runs: [],
        selectedTasks: [],
        selectedRoarUids: [],
        startDate: null,
        endDate: null,
        selectedDistricts: [],
        selectedSchools: [],
        selectedClasses: [],
        selectedStudies: [],
        selectedRootPath: null,
      };
    },
    getters: {
      rootPaths: (state) => {
        const paths = Object.keys(state.rootDocs);
        const groups = [...new Set(paths.map((path) => path.split('/')[0]))];

        const rootPathOptions = groups.map((group) => {
          return {
            label: group,
            items: paths.filter((path) => path.startsWith(group)).map((path) => ({
              label: path.split('/')[1],
              value: path
            }))
          };
        });

        return rootPathOptions;
      },
      selectedRootDoc: (state) => state.rootDocs[state.selectedRootPath?.value],
    },
    actions: {
      async getRootDocs() {
        const prodDoc = doc(db, 'prod', 'roar-prod');
        this.rootDocs = {};
        this.rootDocs[prodDoc.path] = prodDoc;

        const devQuery = query(collection(db, 'dev'));
        const devSnapshot = await getDocs(devQuery);
        devSnapshot.forEach((doc) => {
          this.rootDocs[doc.ref.path] = doc
        });

        const extQuery = query(collection(db, 'external'));
        const extSnapshot = await getDocs(extQuery);
        extSnapshot.forEach((doc) => {
          this.rootDocs[doc.ref.path] = doc
        });

        this.selectedRootPath = {
          label: prodDoc.path.split('/').pop(),
          value: prodDoc.path,
        };
      },
      async getTasks() {
        this.tasksReady = false;
        const taskQuery = query(collection(this.selectedRootDoc, 'tasks'));
        const tasksSnapshot = await getDocs(taskQuery);
        const tasks = [];

        tasksSnapshot.forEach((doc) => {
          tasks.push({
            id: doc.id,
            name: doc.data().name,
          })
        })

        this.tasks = tasks;
        this.tasksReady = true;
      },
      async getVariants() {
        this.variantsReady = false;
        const variants = [];

        for (const task of this.selectedTasks) {
          const variantQuery = query(collection(
            this.selectedRootDoc, 'tasks', task.id, 'variants',
          ));
          const variantsSnapshot = await getDocs(variantQuery);

          const items = []
          variantsSnapshot.forEach((doc) => {
            items.push({
              id: doc.id,
              name: doc.data().name,
            })
          });

          variants.push({
            task: task.id,
            items,
          });
        }

        this.variants = variants;
        this.variantsReady = true;
      }
    },
  })();
};
