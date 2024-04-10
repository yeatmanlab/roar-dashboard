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
            show-icon="pi pi-cog"
            hide-icon="pi pi-times"
            button-class="p-button-outlined p-button-sm w-3rem h-3rem"
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
          <span>{{ taskDisplayNames[assessmentId]?.name ?? assessmentId }}</span>
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
        <PvButton class="mt-2 ml-0" :icon="toggleIcon" size="small" :label="toggleLabel" @click="toggleTable" />
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
              :data="setBarChartData(node.data.stats)"
              :options="setBarChartOptions(node.data.stats)"
              class="h-3rem"
            />
          </template>
        </PvColumn>
        <PvColumn field="id" header="" style="width: 14rem">
          <template #body="{ node }">
            <div class="flex m-0">
              <router-link
                :to="{
                  name: 'ViewAdministration',
                  params: { administrationId: props.id, orgId: node.data.id, orgType: node.data.orgType },
                }"
                class="no-underline"
              >
                <PvButton
                  v-tooltip.top="'See completion details'"
                  class="m-0"
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
                  class="m-0"
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
import _flattenDeep from 'lodash/flattenDeep';
import _fromPairs from 'lodash/fromPairs';
import _isEmpty from 'lodash/isEmpty';
import _mapValues from 'lodash/mapValues';
import _toPairs from 'lodash/toPairs';
import _without from 'lodash/without';
import _zip from 'lodash/zip';

const authStore = useAuthStore();
const { roarfirekit, administrationQueryKeyIndex } = storeToRefs(authStore);

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
  // {
  //   label: 'Edit',
  //   icon: 'pi pi-pencil',
  //   command: () => {
  //     console.log('Edit administration');
  //   },
  // },
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

const displayOrgs = removeEmptyOrgs(props.assignees);
const isAssigned = !_isEmpty(Object.values(displayOrgs));

const showTable = ref(false);
const enableQueries = ref(false);

const toggleIcon = computed(() => {
  if (showTable.value) {
    return 'pi pi-chevron-down';
  }
  return 'pi pi-chevron-right';
});

const toggleLabel = computed(() => {
  if (showTable.value) {
    return 'Hide details';
  }
  return 'Show details';
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

  const promises = [batchGetDocs(orgPaths, ['name', 'schools', 'classes', 'districtId']), batchGetDocs(statsPaths)];

  const [orgDocs, statsDocs] = await Promise.all(promises);

  const dsgfOrgs = _zip(orgDocs, statsDocs).map(([orgDoc, stats], index) => {
    const { classes, schools, collection, ...nodeData } = orgDoc;
    const node = {
      key: String(index),
      data: {
        orgType: singularOrgTypes[collection],
        schools,
        classes,
        stats,
        ...nodeData,
      },
    };
    if (classes)
      node.children = classes.map((classId) => {
        return {
          key: `${node.key}-${classId}`,
          data: {
            orgType: 'class',
            id: classId,
          },
        };
      });
    return node;
  });

  const dependentSchoolIds = _flattenDeep(dsgfOrgs.map((node) => node.data.schools ?? []));
  const independentSchoolIds =
    dsgfOrgs.length > 0 ? _without(props.assignees.schools, ...dependentSchoolIds) : props.assignees.schools;
  const dependentClassIds = _flattenDeep(dsgfOrgs.map((node) => node.data.classes ?? []));
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
    batchGetDocs(independentClassPaths, ['name', 'schoolId']),
    batchGetDocs(independentClassStatPaths),
  ];

  const [classDocs, classStats] = await Promise.all(classPromises);

  const independentClasses = _without(
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

  treeTableOrgs.push(...(independentClasses ?? []));
  treeTableOrgs.push(...dsgfOrgs.filter((node) => node.data.orgType === 'group'));
  treeTableOrgs.push(...dsgfOrgs.filter((node) => node.data.orgType === 'family'));

  return treeTableOrgs;
};

const { data: orgs, isLoading: loadingDsgfOrgs } = useQuery({
  queryKey: ['dsgfOrgs', props.id],
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

const getBorderRadii = (left, middle, right) => {
  const defaultRadius = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
  const borderRadii = { left: { ...defaultRadius }, middle: { ...defaultRadius }, right: { ...defaultRadius } };
  if (left > 0) {
    borderRadii.left.topLeft = Number.MAX_VALUE;
    borderRadii.left.bottomLeft = Number.MAX_VALUE;
  } else if (middle > 0) {
    borderRadii.middle.topLeft = Number.MAX_VALUE;
    borderRadii.middle.bottomLeft = Number.MAX_VALUE;
  } else {
    borderRadii.right.topLeft = Number.MAX_VALUE;
    borderRadii.right.bottomLeft = Number.MAX_VALUE;
  }

  if (right > 0) {
    borderRadii.right.topRight = Number.MAX_VALUE;
    borderRadii.right.bottomRight = Number.MAX_VALUE;
  } else if (middle > 0) {
    borderRadii.middle.topRight = Number.MAX_VALUE;
    borderRadii.middle.bottomRight = Number.MAX_VALUE;
  } else {
    borderRadii.left.topRight = Number.MAX_VALUE;
    borderRadii.left.bottomRight = Number.MAX_VALUE;
  }

  return borderRadii;
};

const setBarChartData = (orgStats) => {
  let { assigned = 0, started = 0, completed = 0 } = orgStats?.assignment || {};
  const documentStyle = getComputedStyle(document.documentElement);

  started -= completed;
  assigned -= started + completed;

  const borderRadii = getBorderRadii(completed, started, assigned);
  const borderWidth = 0;

  const chartData = {
    labels: [''],
    datasets: [
      {
        type: 'bar',
        label: 'Completed',
        backgroundColor: documentStyle.getPropertyValue('--bright-green'),
        data: [completed],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.left,
      },
      {
        type: 'bar',
        label: 'Started',
        backgroundColor: documentStyle.getPropertyValue('--yellow-100'),
        data: [started],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.middle,
      },
      {
        type: 'bar',
        label: 'Assigned',
        backgroundColor: documentStyle.getPropertyValue('--surface-d'),
        data: [assigned],
        borderWidth: borderWidth,
        borderSkipped: false,
        borderRadius: borderRadii.right,
      },
    ],
  };

  return chartData;
};

const setBarChartOptions = (orgStats) => {
  let { assigned = 0 } = orgStats?.assignment || {};

  const min = 0;
  const max = assigned;

  return {
    indexAxis: 'y',
    maintainAspectRatio: false,
    aspectRatio: 9,
    plugins: {
      tooltips: {
        mode: 'index',
        intersect: false,
      },
      legend: false,
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          display: false,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        min,
        max,
      },
      y: {
        stacked: true,
        ticks: {
          display: false,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        min,
        max,
      },
    },
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
