import { defineStore } from "pinia";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
} from "@firebase/firestore";
import { roarfirekit } from "../firebaseInit.js";
import { formatDate, getOrgs, getUniquePropsFromUsers, userHasSelectedOrgs } from "../helpers/index.js";

export const useQueryStore = () => {
  return defineStore({
    id: "queryStore",
    state: () => {
      return {
        activeTab: 0,
        allVariants: [],
        classes: [],
        districts: [],
        endDate: null,
        percentCompleteRuns: 0,
        percentCompleteTrials: 0,
        rootDocs: {},
        runs: [],
        runsReady: false,
        schools: [],
        selectedClasses: [],
        selectedDistricts: [],
        selectedRootPath: null,
        selectedRuns: [],
        selectedSchools: [],
        selectedStudies: [],
        selectedTasks: [],
        selectedTrials: [],
        selectedUsers: [],
        selectedVariants: [],
        startDate: null,
        studies: [],
        tasks: [],
        tasksReady: false,
        trialColumns: [],
        trials: [],
        trialsReady: false,
        users: [],
        usersReady: false,
        variantsReady: false,
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
      variants: (state) => state.allVariants.filter((taskGroup) => state.selectedTaskIds.includes(taskGroup.task)),
      districts: (state) => getUniquePropsFromUsers(state.users, "districts"),
      schools: (state) => getUniquePropsFromUsers(state.users, "schools"),
      classes: (state) => getUniquePropsFromUsers(state.users, "classes"),
      studies: (state) => getUniquePropsFromUsers(state.users, "studies"),
      nRuns: (state) => state.runs.length,
      nTrials: (state) => state.trials.length,
      runTasks: (state) => [...new Set(state.runs.map((run) => run.task.id))].map((id) => ({ id })),
      runVariants: (state) => [...new Set(state.runs.map((run) => run.variant.id))].map((id) => ({ id })),
      runDistricts: (state) => [...new Set(state.runs.map((run) => run.district.id))].map((id) => ({ id })),
      runSchools: (state) => [...new Set(state.runs.map((run) => run.school.id))].map((id) => ({ id })),
      runClasses: (state) => [...new Set(state.runs.map((run) => run.class.id))].map((id) => ({ id })),
      runStudies: (state) => [...new Set(state.runs.map((run) => run.study.id))].map((id) => ({ id })),
    },
    actions: {
      async getRootDocs() {
        const prodDoc = doc(roarfirekit.app.db, 'prod', 'roar-prod');
        this.rootDocs = {};
        this.rootDocs[prodDoc.path] = prodDoc;

        const devQuery = query(collection(roarfirekit.app.db, 'dev'));
        const devSnapshot = await getDocs(devQuery);
        devSnapshot.forEach((doc) => {
          this.rootDocs[doc.ref.path] = doc
        });

        const extQuery = query(collection(roarfirekit.app.db, 'external'));
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

        for (const task of this.tasks) {
          const variantQuery = query(collection(
            this.selectedRootDoc, 'tasks', task.id, 'variants',
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
            task: task.id,
            items,
          });
        }

        this.allVariants = variants;
        this.variantsReady = true;
      },
      async getUsers() {
        this.usersReady = false;
        const users = [];

        if (this.selectedTaskIds.length > 0) {
          let userQuery;
          if (this.selectedVariantIds.length > 0) {
            userQuery = query(
              collection(this.selectedRootDoc, 'users'),
              where('variants', 'array-contains-any', this.selectedVariantIds),
            );
          } else {
            userQuery = query(
              collection(this.selectedRootDoc, 'users'),
              where('tasks', 'array-contains-any', this.selectedTaskIds),
            );
          }

          const usersSnapshot = await getDocs(userQuery);
          usersSnapshot.forEach((doc) => {
            const {
              districtIds,
              schoolIds,
              studyIds,
              classIds,
            } = getOrgs(doc.data());

            users.push({
              roarUid: doc.id,
              districts: districtIds,
              schools: schoolIds,
              studies: studyIds,
              classes: classIds,
            })
          });

          this.users = users;
          this.usersReady = true;
        } else {
          this.users = [];
          this.usersReady = false;
        }
      },
      async getRuns() {
        this.activeTab = 1;

        this.runsReady = false;
        this.percentCompleteRuns = 0
        const percentIncrement = 100 / this.selectedUsers.length;

        this.runs = [];

        for (const user of this.selectedUsers) {
          const {
            roarUid,
            districtIds,
            schoolIds,
            classIds,
            studyIds,
          } = user

          const filterOrgs = [
            userHasSelectedOrgs(districtIds, this.selectedDistricts),
            userHasSelectedOrgs(schoolIds, this.selectedSchools),
            userHasSelectedOrgs(classIds, this.selectedClasses),
            userHasSelectedOrgs(studyIds, this.selectedStudies),
          ];
          const isUserSelected = filterOrgs.every((element) => element === true);

          if (isUserSelected) {
            let runsQuery;
            if (this.selectedVariantIds.length > 0) {
              runsQuery = query(
                collection(this.selectedRootDoc, 'users', roarUid, 'runs'),
                where('variantId', 'in', this.selectedVariantIds),
              );
            } else {
              runsQuery = query(
                collection(this.selectedRootDoc, 'users', roarUid, 'runs'),
                where('taskId', 'in', this.selectedTaskIds),
              );
            }

            const runsSnapshot = await getDocs(runsQuery);
            runsSnapshot.forEach((doc) => {
              const runData = doc.data();
              runData.timeStarted = formatDate(runData.timeStarted?.toDate()) || null;
              runData.timeFinished = formatDate(runData.timeFinished?.toDate()) || null;
              runData.task = { id: runData.taskId };
              runData.variant = { id: runData.variantId };
              runData.district = { id: runData.districtId };
              runData.school = { id: runData.schoolId };
              runData.class = { id: runData.classId };
              runData.study = { id: runData.studyId };

              delete runData.taskRef;
              delete runData.variantRef;
              delete runData.taskId;
              delete runData.variantId;
              delete runData.districtId;
              delete runData.schoolId;
              delete runData.classId;
              delete runData.studyId;

              const thisRun = {
                roarUid: roarUid,
                runId: doc.id,
                ...runData
              }
              this.runs.push(thisRun);
            });
          }

          this.percentCompleteRuns = Math.min(100, this.percentCompleteRuns + percentIncrement);
        }

        this.runsReady = true;
        this.percentCompleteRuns = 0;
      },
      async getTrials() {
        this.activeTab = 2;

        this.trialsReady = false;
        this.percentCompleteTrials = 0
        const percentIncrement = 100 / this.selectedRuns.length;

        this.trials = [];
        const trialColumns = [];

        for (const run of this.selectedRuns) {
          const trialsQuery = query(
            collection(this.selectedRootDoc, 'users', run.roarUid, 'runs', run.runId, 'trials'),
          );

          const trialsSnapshot = await getDocs(trialsQuery);
          trialsSnapshot.forEach((doc) => {
            const trialData = doc.data();
            trialData.timeStarted = formatDate(trialData.timeStarted?.toDate()) || null;
            trialData.timeFinished = formatDate(trialData.timeFinished?.toDate()) || null;
            trialData.task = { id: trialData.taskId };
            trialData.variant = { id: trialData.variantId };
            trialData.district = { id: trialData.districtId };
            trialData.school = { id: trialData.schoolId };
            trialData.class = { id: trialData.classId };
            trialData.study = { id: trialData.studyId };

            const thisTrial = {
              roarUid: run.roarUid,
              runId: run.runId,
              ...trialData
            }
            this.trials.push(thisTrial);
            trialColumns.push(...Object.keys(thisTrial));
          });

          this.trialColumns = [...new Set(trialColumns)].map((key) => ({
            field: key, header: key,
          }))
          this.percentCompleteTrials = Math.min(100, this.percentCompleteTrials + percentIncrement);
        }

        this.trialsReady = true;
        this.percentCompleteTrials = 0;
      },
    },
  })();
};
