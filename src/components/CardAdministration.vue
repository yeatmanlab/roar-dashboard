<template>
  <div class="p-card card-administration mb-1 w-full">
    <div v-if="props.stats && isSuperAdmin" class="card-admin-chart">
      <PvChart type="doughnut" :data="doughnutChartData" :options="doughnutChartOptions" />
    </div>

    <div class="card-admin-body w-full">
      <div class="flex flex-row w-full md:h-2rem sm:h-3rem">
        <div class="flex-grow-1 pr-3 mr-2 p-0 m-0">
          <h2 data-cy="h2-card-admin-title" class="sm:text-lg lg:text-lx m-0">{{ title }}</h2>
        </div>
        <div v-if="isSuperAdmin" class="flex justify-content-end w-3 pl-5 pb-5 ml-2 mb-6">
          <PvSpeedDial
            :model="speedDialItems"
            direction="left"
            :transition-delay="80"
            show-icon="pi pi-cog text-primary"
            hide-icon="pi pi-times"
            button-class="p-button-outlined p-button-sm w-3rem h-3rem border-primary border-1 border-circle bg-transparent hover:surface-300"
            :tooltip-options="{ position: 'top' }"
            :pt="{ button: { size: 'small' } }"
          />
          <PvConfirmPopup />
        </div>
      </div>
      <div class="card-admin-details">
        <span class="mr-1"><strong>Dates</strong>:</span>
        <span class="mr-1">
          {{ processedDates.start.toLocaleDateString() }} — {{ processedDates.end.toLocaleDateString() }}
        </span>
      </div>
      <div class="card-admin-assessments">
        <span class="mr-1"><strong>Assessments</strong>:</span>
        <span v-for="assessmentId in assessmentIds" :key="assessmentId" class="card-inline-list-item">
          <span>{{ tasksDictionary[assessmentId]?.publicName ?? assessmentId }}</span>
          <span
            v-if="showParams"
            v-tooltip.top="'Click to view params'"
            class="pi pi-info-circle cursor-pointer ml-1"
            style="font-size: 1rem"
            @click="toggleParams($event, assessmentId)"
          />
        </span>
        <div v-if="showParams">
          <PvOverlayPanel v-for="assessmentId in assessmentIds" :key="assessmentId" :ref="paramPanelRefs[assessmentId]">
            <div v-if="getAssessment(assessmentId).variantId">
              Variant ID: {{ getAssessment(assessmentId).variantId }}
            </div>
            <div v-if="getAssessment(assessmentId).variantName">
              Variant Name: {{ getAssessment(assessmentId).variantName }}
            </div>
            <PvDataTable
              striped-rows
              class="p-datatable-small"
              table-style="min-width: 30rem"
              :value="toEntryObjects(params[assessmentId])"
            >
              <PvColumn field="key" header="Parameter" style="width: 50%"></PvColumn>
              <PvColumn field="value" header="Value" style="width: 50%"></PvColumn>
            </PvDataTable>
          </PvOverlayPanel>
        </div>
      </div>
      <div v-if="isAssigned">
        <PvButton
          class="mt-2 m-0 bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
          :icon="toggleIcon"
          style="padding: 1rem; padding-top: 1.2rem; padding-bottom: 1.2rem"
          size="small"
          :label="toggleLabel"
          @click="toggleTable"
        />
      </div>
      <PvTreeTable
        v-if="showTable"
        class="mt-3"
        lazy
        row-hover
        :loading="loadingTreeTable"
        :value="treeTableOrgs"
        @node-expand="onExpand"
      >
        <PvColumn field="name" header="Name" expander style="width: 20rem"></PvColumn>
        <PvColumn v-if="props.stats && isWideScreen" field="id" header="Completion">
          <template #body="{ node }">
            <PvChart
              type="bar"
              :data="setBarChartData(node.data.stats?.assignment)"
              :options="setBarChartOptions(node.data.stats?.assignment)"
              class="h-3rem"
            />
          </template>
        </PvColumn>
        <PvColumn field="id" header="" style="width: 14rem">
          <template #body="{ node }">
            <div v-if="node.data.id" class="flex m-0">
              <router-link
                :to="{
                  name: 'ViewAdministration',
                  params: { administrationId: props.id, orgId: node.data.id, orgType: node.data.orgType },
                }"
                class="no-underline"
              >
                <PvButton
                  v-tooltip.top="'See completion details'"
                  class="m-0 mr-1 surface-0 text-bluegray-500 shadow-1 border-none p-2 border-round hover:surface-100"
                  style="height: 2.5rem"
                  severity="secondary"
                  text
                  raised
                  label="Progress"
                  aria-label="Completion details"
                  size="small"
                  data-cy="button-progress"
                />
              </router-link>
              <router-link
                :to="{
                  name: 'ScoreReport',
                  params: { administrationId: props.id, orgId: node.data.id, orgType: node.data.orgType },
                }"
                class="no-underline"
              >
                <PvButton
                  v-tooltip.top="'See Scores'"
                  class="m-0 mr-1 surface-0 text-bluegray-500 shadow-1 border-none p-2 border-round hover:surface-100"
                  style="height: 2.5rem"
                  severity="secondary"
                  text
                  raised
                  label="Scores"
                  aria-label="Scores"
                  size="small"
                  data-cy="button-scores"
                />
              </router-link>
            </div>
          </template>
        </PvColumn>
      </PvTreeTable>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { storeToRefs } from 'pinia';
import { batchGetDocs } from '@/helpers/query/utils';
import { taskDisplayNames } from '@/helpers/reports';
import { useAuthStore } from '@/store/auth';
import { removeEmptyOrgs } from '@/helpers';
import { useRouter } from 'vue-router';
import _flattenDeep from 'lodash/flattenDeep';
import _fromPairs from 'lodash/fromPairs';
import _isEmpty from 'lodash/isEmpty';
import _mapValues from 'lodash/mapValues';
import _toPairs from 'lodash/toPairs';
import _without from 'lodash/without';
import _zip from 'lodash/zip';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';

const router = useRouter();

const authStore = useAuthStore();
const { roarfirekit, administrationQueryKeyIndex, uid, tasksDictionary } = storeToRefs(authStore);

const props = defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  publicName: { type: String, required: true },
  stats: { type: Object, required: false, default: () => ({}) },
  dates: { type: Object, required: true },
  assignees: { type: Object, required: true },
  assessments: { type: Array, required: true },
  showParams: { type: Boolean, required: true },
  isSuperAdmin: { type: Boolean, required: true },
});

const confirm = useConfirm();
const toast = useToast();

const speedDialItems = ref([
  {
    label: 'Delete',
    icon: 'pi pi-trash',
    command: (event) => {
      confirm.require({
        target: event.originalEvent.currentTarget,
        message: 'Are you sure you want to delete this administration?',
        icon: 'pi pi-exclamation-triangle',
        accept: async () => {
          await roarfirekit.value.deleteAdministration(props.id).then(() => {
            toast.add({
              severity: 'info',
              summary: 'Confirmed',
              detail: `Deleted administration ${props.title}`,
              life: 3000,
            });
            administrationQueryKeyIndex.value += 1;
          });
        },
        reject: () => {
          toast.add({ severity: 'error', summary: 'Rejected', detail: 'Deletion aborted', life: 3000 });
        },
      });
    },
  },
  {
    label: 'Edit',
    icon: 'pi pi-pencil',
    command: () => {
      router.push({ name: 'EditAdministration', params: { adminId: props.id } });
    },
  },
]);

const processedDates = computed(() => {
  return _mapValues(props.dates, (date) => {
    return new Date(date);
  });
});

const assessmentIds = props.assessments
  .map((assessment) => assessment.taskId.toLowerCase())
  .sort((p1, p2) => {
    return (taskDisplayNames[p1]?.order ?? 0) - (taskDisplayNames[p2]?.order ?? 0);
  });

const paramPanelRefs = _fromPairs(props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), ref()]));
const params = _fromPairs(props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), assessment.params]));

const toEntryObjects = (inputObj) => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
};

const toggleParams = (event, id) => {
  paramPanelRefs[id].value[0].toggle(event);
};

function getAssessment(assessmentId) {
  return props.assessments.find((assessment) => assessment.taskId.toLowerCase() === assessmentId);
}

const displayOrgs = removeEmptyOrgs(props.assignees);
const isAssigned = !_isEmpty(Object.values(displayOrgs));

const showTable = ref(false);
const enableQueries = ref(false);

const toggleIcon = computed(() => {
  if (showTable.value) {
    return 'pi pi-chevron-down mr-1';
  }
  return 'pi pi-chevron-right mr-2';
});

const toggleLabel = computed(() => {
  if (showTable.value) {
    return 'Hide details';
  }
  return ' Show details';
});

const toggleTable = () => {
  enableQueries.value = true;
  showTable.value = !showTable.value;
};

const isWideScreen = computed(() => {
  return window.innerWidth > 768;
});

const singularOrgTypes = {
  districts: 'district',
  schools: 'school',
  classes: 'class',
  groups: 'group',
  families: 'families',
};

// dsgf: districts, schools, groups, families
const fetchTreeOrgs = async () => {
  const orgTypes = ['districts', 'schools', 'groups', 'families'];
  const orgPaths = _flattenDeep(
    orgTypes.map((orgType) => (props.assignees[orgType] ?? []).map((orgId) => `${orgType}/${orgId}`) ?? []),
  );

  const statsPaths = _flattenDeep(
    orgTypes.map(
      (orgType) => (props.assignees[orgType] ?? []).map((orgId) => `administrations/${props.id}/stats/${orgId}`) ?? [],
    ),
  );

  const promises = [
    batchGetDocs(orgPaths, ['name', 'schools', 'classes', 'archivedSchools', 'archivedClasses', 'districtId']),
    batchGetDocs(statsPaths),
  ];

  const [orgDocs, statsDocs] = await Promise.all(promises);

  const dsgfOrgs = _without(
    _zip(orgDocs, statsDocs).map(([orgDoc, stats], index) => {
      if (!orgDoc || _isEmpty(orgDoc)) {
        return undefined;
      }
      const { classes, schools, archivedSchools, archivedClasses, collection, ...nodeData } = orgDoc;
      const node = {
        key: String(index),
        data: {
          orgType: singularOrgTypes[collection],
          schools,
          classes,
          archivedSchools,
          archivedClasses,
          stats,
          ...nodeData,
        },
      };
      if (classes || archivedClasses)
        node.children = [...(classes ?? []), ...(archivedClasses ?? [])].map((classId) => {
          return {
            key: `${node.key}-${classId}`,
            data: {
              orgType: 'class',
              id: classId,
            },
          };
        });
      return node;
    }),
    undefined,
  );

  const districtIds = dsgfOrgs.filter((node) => node.data.orgType === 'district').map((node) => node.data.id);

  const dependentSchoolIds = _flattenDeep(
    dsgfOrgs.map((node) => [...(node.data.schools ?? []), ...(node.data.archivedSchools ?? [])]),
  );
  const independentSchoolIds =
    dsgfOrgs.length > 0 ? _without(props.assignees.schools, ...dependentSchoolIds) : props.assignees.schools;
  const dependentClassIds = _flattenDeep(
    dsgfOrgs.map((node) => [...(node.data.classes ?? []), ...(node.data.archivedClasses ?? [])]),
  );
  const independentClassIds =
    dsgfOrgs.length > 0 ? _without(props.assignees.classes, ...dependentClassIds) : props.assignees.classes;

  const independentSchools = (dsgfOrgs ?? []).filter((node) => {
    return node.data.orgType === 'school' && independentSchoolIds.includes(node.data.id);
  });

  const dependentSchools = (dsgfOrgs ?? []).filter((node) => {
    return node.data.orgType === 'school' && !independentSchoolIds.includes(node.data.id);
  });

  const independentClassPaths = independentClassIds.map((classId) => `classes/${classId}`);
  const independentClassStatPaths = independentClassIds.map(
    (classId) => `administrations/${props.id}/stats/${classId}`,
  );

  const classPromises = [
    batchGetDocs(independentClassPaths, ['name', 'schoolId', 'districtId']),
    batchGetDocs(independentClassStatPaths),
  ];

  const [classDocs, classStats] = await Promise.all(classPromises);

  let independentClasses = _without(
    _zip(classDocs, classStats).map(([orgDoc, stats], index) => {
      const { collection = 'classes', ...nodeData } = orgDoc ?? {};

      if (_isEmpty(nodeData)) return undefined;

      const node = {
        key: String(dsgfOrgs.length + index),
        data: {
          orgType: singularOrgTypes[collection],
          ...(stats && { stats }),
          ...nodeData,
        },
      };
      return node;
    }),
    undefined,
  );

  // These are classes that are directly under a district, without a school
  // They were eroneously categorized as independent classes but now we need
  // to remove them from the independent classes array
  const directReportClasses = independentClasses.filter((node) => districtIds.includes(node.data.districtId));
  independentClasses = independentClasses.filter((node) => !districtIds.includes(node.data.districtId));

  const treeTableOrgs = dsgfOrgs.filter((node) => node.data.orgType === 'district');
  treeTableOrgs.push(...independentSchools);

  for (const school of dependentSchools) {
    const districtId = school.data.districtId;
    const districtIndex = treeTableOrgs.findIndex((node) => node.data.id === districtId);
    if (districtIndex !== -1) {
      if (treeTableOrgs[districtIndex].children === undefined) {
        treeTableOrgs[districtIndex].children = [
          {
            ...school,
            key: `${treeTableOrgs[districtIndex].key}-${school.key}`,
          },
        ];
      } else {
        treeTableOrgs[districtIndex].children.push(school);
      }
    } else {
      treeTableOrgs.push(school);
    }
  }

  for (const _class of directReportClasses) {
    const districtId = _class.data.districtId;
    const districtIndex = treeTableOrgs.findIndex((node) => node.data.id === districtId);
    if (districtIndex !== -1) {
      const directReportSchoolKey = `${treeTableOrgs[districtIndex].key}-9999`;
      const directReportSchool = {
        key: directReportSchoolKey,
        data: {
          orgType: 'school',
          orgId: '9999',
          name: 'Direct Report Classes',
        },
        children: [
          {
            ..._class,
            key: `${directReportSchoolKey}-${_class.key}`,
          },
        ],
      };
      if (treeTableOrgs[districtIndex].children === undefined) {
        treeTableOrgs[districtIndex].children = [directReportSchool];
      } else {
        const schoolIndex = treeTableOrgs[districtIndex].children.findIndex(
          (node) => node.key === directReportSchoolKey,
        );
        if (schoolIndex === -1) {
          treeTableOrgs[districtIndex].children.push(directReportSchool);
        } else {
          treeTableOrgs[districtIndex].children[schoolIndex].children.push(_class);
        }
      }
    } else {
      treeTableOrgs.push(_class);
    }
  }

  treeTableOrgs.push(...(independentClasses ?? []));
  treeTableOrgs.push(...dsgfOrgs.filter((node) => node.data.orgType === 'group'));
  treeTableOrgs.push(...dsgfOrgs.filter((node) => node.data.orgType === 'family'));

  (treeTableOrgs ?? []).forEach((node) => {
    // Sort the schools by existance of stats then alphabetically
    if (node.children) {
      node.children.sort((a, b) => {
        if (!a.data.stats) return 1;
        if (!b.data.stats) return -1;
        return a.data.name.localeCompare(b.data.name);
      });
    }
  });

  return treeTableOrgs;
};

const { data: orgs, isLoading: loadingDsgfOrgs } = useQuery({
  queryKey: ['dsgfOrgs', uid, props.id],
  queryFn: () => fetchTreeOrgs(),
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000, // 5 minutes
  enabled: enableQueries,
});

const loadingTreeTable = computed(() => {
  return loadingDsgfOrgs.value || expanding.value;
});

const treeTableOrgs = ref([]);
watch(orgs, (newValue) => {
  treeTableOrgs.value = newValue;
});

watch(showTable, (newValue) => {
  if (newValue) treeTableOrgs.value = orgs.value;
});

const expanding = ref(false);
const onExpand = async (node) => {
  if (node.data.orgType === 'school' && node.children?.length > 0 && !node.data.expanded) {
    expanding.value = true;

    const classPaths = node.children.map(({ data }) => `classes/${data.id}`);
    const statPaths = node.children.map(({ data }) => `administrations/${props.id}/stats/${data.id}`);

    const classPromises = [batchGetDocs(classPaths, ['name', 'schoolId']), batchGetDocs(statPaths)];

    const [classDocs, classStats] = await Promise.all(classPromises);

    // Lazy node is a copy of the expanding node. We will insert more detailed
    // children nodes later.
    const lazyNode = {
      key: node.key,
      data: {
        ...node.data,
        expanded: true,
      },
    };

    const childNodes = _without(
      _zip(classDocs, classStats).map(([orgDoc, stats], index) => {
        const { collection = 'classes', ...nodeData } = orgDoc ?? {};

        if (_isEmpty(nodeData)) return undefined;

        return {
          key: `${node.key}-${index}`,
          data: {
            orgType: singularOrgTypes[collection],
            ...(stats && { stats }),
            ...nodeData,
          },
        };
      }),
      undefined,
    );

    lazyNode.children = childNodes;

    // Replace the existing nodes with a map that inserts the child nodes at the
    // appropriate position
    const newNodes = treeTableOrgs.value.map((n) => {
      // First, match on the districtId if the expanded school is part of a district
      if (n.data.id === node.data.districtId) {
        const newNode = {
          ...n,
          // Replace the existing school child nodes with a map that inserts the
          // classes at the appropriate position
          children: n.children.map((child) => {
            if (child.data.id === node.data.id) {
              return lazyNode;
            }
            return child;
          }),
        };
        return newNode;
        // Next check to see if the expanded node was the school node itself
      } else if (n.data.id === node.data.id) {
        return lazyNode;
      }

      return n;
    });

    // Sort the classes by existence of stats then alphabetically
    console.log('newNodes', newNodes);
    (newNodes ?? []).forEach((districtNode) => {
      for (const schoolNode of districtNode?.children ?? []) {
        if (schoolNode.children) {
          schoolNode.children = schoolNode.children.toSorted((a, b) => {
            if (!a.data.stats) return 1;
            if (!b.data.stats) return -1;
            return a.data.name.localeCompare(b.data.name);
          });
        }
      }
    });

    treeTableOrgs.value = newNodes;
    expanding.value = false;
  }
};

const doughnutChartData = ref();
const doughnutChartOptions = ref();

const setDoughnutChartOptions = () => ({
  cutout: '60%',
  showToolTips: true,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
    },
  },
});

const setDoughnutChartData = () => {
  const docStyle = getComputedStyle(document.documentElement);
  let { assigned = 0, started = 0, completed = 0 } = props.stats.total?.assignment || {};

  started -= completed;
  assigned -= started + completed;

  return {
    labels: ['Completed', 'Started', 'Assigned'],
    datasets: [
      {
        data: [completed, started, assigned],
        backgroundColor: [
          docStyle.getPropertyValue('--bright-green'),
          docStyle.getPropertyValue('--yellow-100'),
          docStyle.getPropertyValue('--surface-d'),
        ],
        // hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
      },
    ],
  };
};

onMounted(() => {
  if (props.stats) {
    doughnutChartData.value = setDoughnutChartData();
    doughnutChartOptions.value = setDoughnutChartOptions();
  }
});
</script>

<style lang="scss">
.p-confirm-popup .p-confirm-popup-footer button {
  background-color: var(--primary-color);
  border: none;
  border-radius: 0.35rem;
  padding: 0.4em;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  color: white;
}
.p-confirm-popup .p-confirm-popup-footer button:hover {
  background-color: var(--red-900);
}

.card-administration {
  text-align: left;
  width: 100%;
  background: var(--surface-b);
  border: 1px solid var(--surface-d);
  border-radius: var(--border-radius);
  display: flex;
  flex-direction: row;
  gap: 2rem;
  padding: 1rem;

  .card-admin-chart {
    width: 12ch;
  }

  .card-admin-body {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    align-content: start;
  }

  .break {
    flex-basis: 100%;
    height: 0;
  }

  .card-admin-title {
    font-weight: bold;
    width: 100%;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--surface-d);
    flex: 1 1 100%;
  }

  .card-admin-link {
    margin-top: 2rem;
    width: 100%;
  }

  .card-admin-class-list {
    width: 100%;
    margin-top: 2rem;
  }

  .cursor-pointer {
    cursor: pointer;
  }
}

.card-inline-list-item {
  position: relative;

  &:not(:last-child):after {
    content: ', ';
  }
}
</style>
