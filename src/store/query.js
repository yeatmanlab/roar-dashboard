import { defineStore } from "pinia";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
} from "@firebase/firestore";
import { db } from "../firebaseInit.js";
import { getIds, idArrayToObjArray } from "../helpers/index.js";

export const useQueryStore = () => {
  return defineStore({
    id: "queryStore",
    state: () => {
      return {
        tasks: [],
        tasksReady: false,
        variants: [],
        variantsReady: false,
        roarUids: [],
        usersReady: false,
        districts: [],
        schools: [],
        classes: [],
        studies: [],
        rootDocs: {},
        runs: [],
        selectedTasks: [],
        selectedVariants: [],
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
      selectedTaskIds: (state) => state.selectedTasks.map((task) => task.id),
      selectedVariantIds: (state) => state.selectedVariants.map((variant) => variant.id),
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

        for (const taskId of this.selectedTaskIds) {
          const variantQuery = query(collection(
            this.selectedRootDoc, 'tasks', taskId, 'variants',
          ));
          const variantsSnapshot = await getDocs(variantQuery);

          const items = []
          variantsSnapshot.forEach((doc) => {
            if (doc.id !== 'empty') {
              items.push({
                id: doc.id,
                name: doc.data().name,
                nameId: `${doc.data().name}-${doc.id}`
              });
            }
          });

          variants.push({
            task: taskId,
            items,
          });
        }

        const selectedVariants = []
        variants.forEach((task) => selectedVariants.push(...task.items))

        this.variants = variants;
        this.selectedVariants = selectedVariants;
        this.variantsReady = true;
      },
      async getUsers() {
        this.usersReady = false;
        const users = [];
        const userDistricts = [];
        const userSchools = [];
        const userClasses = [];
        const userStudies = [];

        if (this.selectedVariantIds.length > 0) {
          const userQuery = query(
            collection(this.selectedRootDoc, 'users'),
            where('variants', 'array-contains-any', this.selectedVariantIds),
          );

          const usersSnapshot = await getDocs(userQuery);
          usersSnapshot.forEach((doc) => {
            users.push({
              roarUid: doc.id,
            })
            const {
              districtId,
              schoolId,
              schools,
              classId,
              classes,
              studyId,
              studies,
            } = doc.data()
            userDistricts.push(...getIds(districtId, null))
            userSchools.push(...getIds(schoolId, schools))
            userClasses.push(...getIds(classId, classes))
            userStudies.push(...getIds(studyId, studies))
          });

          this.roarUids = users;
          this.districts = idArrayToObjArray(userDistricts);
          this.schools = idArrayToObjArray(userSchools);
          this.classes = idArrayToObjArray(userClasses);
          this.studies = idArrayToObjArray(userStudies);
          this.usersReady = true;
        } else {
          this.roarUids = [];
          this.districts = [];
          this.schools = [];
          this.classes = [];
          this.studies = [];
          this.usersReady = false;
        }
      }
    },
  })();
};
