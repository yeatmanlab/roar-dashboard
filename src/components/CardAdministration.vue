<template>
  <div class="p-card card-administration mb-4 w-full">
    <div v-if="props.stats && isSuperAdmin" class="card-admin-chart">
      <PvChart type="doughnut" :data="doughnutChartData" :options="doughnutChartOptions" />
    </div>
    <div class="card-admin-body w-full">
      <div class="flex flex-row w-full md:h-2rem sm:h-3rem">
        <div class="flex-grow-1 pr-3 mr-2 p-0 m-0">
          <h2 data-cy="h2-card-admin-title" class="sm:text-lg lg:text-lx m-0 h2-card-admin-title">{{ title }}</h2>
        </div>
        <div class="flex justify-content-end w-3 pl-5 pb-5 ml-2 mb-6">
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
        <span class="mr-1"><strong>Availability</strong>:</span>
        <span class="mr-1">
          {{ processedDates.start.toLocaleDateString() }} — {{ processedDates.end.toLocaleDateString() }}
        </span>
        <span :class="['status-badge', administrationStatusBadge]">
          {{ administrationStatus }}
        </span>
      </div>
      <div class="card-admin-assessments">
        <span class="mr-1"><strong>Tasks</strong>:</span>
        <template v-if="!isLoadingTasksDictionary">
          <span v-for="assessmentId in assessmentIds" :key="assessmentId" class="card-inline-list-item">
            <span>{{ tasksDictionary[assessmentId]?.name ?? assessmentId }}</span>
            <span
              v-if="showParams"
              v-tooltip.top="'View parameters'"
              class="pi pi-info-circle cursor-pointer ml-1"
              style="font-size: 1rem"
              @click="toggleParams($event, assessmentId)"
            />
          </span>
        </template>

        <div v-if="showParams">
          <PvPopover v-for="assessmentId in assessmentIds" :key="assessmentId" :ref="paramPanelRefs[assessmentId]">
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
          </PvPopover>
        </div>
      </div>
      <PvTreeTable
        class="mt-3"
        lazy
        row-hover
        :loading="loadingTreeTable"
        :value="treeTableOrgs"
        @node-expand="onExpand"
        
      >
        <PvColumn field="name" expander style="width: 20rem"></PvColumn>
        <PvColumn v-if="props.stats && isWideScreen" field="id">
          <template #body="{ node }">
            <PvChart
              type="bar"
              :data="setBarChartData(node.data.stats?.assignment)"
              :options="setBarChartOptions(node.data.stats?.assignment)"
              class="h-3rem w-full"
            />
          </template>
        </PvColumn>
        <PvColumn field="id" header="" style="width: 14rem">
          <template #body="{ node }">
            <div v-if="node.data.id" class="flex m-0">
              <router-link
                :to="{
                  name: 'ProgressReport',
                  params: { administrationId: props.id, orgId: node.data.id, orgType: node.data.orgType },
                }"
                class="no-underline text-black"
              >
                <PvButton
                  v-tooltip.top="'See completion details'"
                  class="m-0 mr-1 surface-0 text-bluegray-500 shadow-1 border-none p-2 border-round hover:surface-100"
                  style="height: 2.5rem; color: var(--primary-color) !important"
                  severity="secondary"
                  text
                  raised
                  label="See Details"
                  aria-label="Completion details"
                  size="small"
                  data-cy="button-progress"
                />
              </router-link>
              <router-link
                v-if="!isLevante"
                :to="{
                  name: 'ScoreReport',
                  params: { administrationId: props.id, orgId: node.data.id, orgType: node.data.orgType },
                }"
                class="no-underline"
              >
                <PvButton
                  v-tooltip.top="'See Scores'"
                  class="m-0 mr-1 surface-0 text-bluegray-500 shadow-1 border-none p-2 border-round hover:surface-100"
                  style="height: 2.5rem; color: var(--primary-color) !important"
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
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import _fromPairs from 'lodash/fromPairs';
import _isEmpty from 'lodash/isEmpty';
import _mapValues from 'lodash/mapValues';
import _toPairs from 'lodash/toPairs';
import _without from 'lodash/without';
import _zip from 'lodash/zip';
import PvButton from 'primevue/button';
import PvColumn from 'primevue/column';
import PvChart from 'primevue/chart';
import PvConfirmPopup from 'primevue/confirmpopup';
import PvDataTable from 'primevue/datatable';
import PvPopover from 'primevue/popover';
import PvSpeedDial from 'primevue/speeddial';
import PvTreeTable from 'primevue/treetable';
import { batchGetDocs } from '@/helpers/query/utils';
import { taskDisplayNames } from '@/helpers/reports';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import useDsgfOrgQuery from '@/composables/queries/useDsgfOrgQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import useDeleteAdministrationMutation from '@/composables/mutations/useDeleteAdministrationMutation';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
import { isLevante } from '@/helpers';

const router = useRouter();

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

const { mutateAsync: deleteAdministration } = useDeleteAdministrationMutation();

const administrationStatus = computed(() => {
  const now = new Date();
  const dateClosed = new Date(props.dates.end);
  let status = 'OPEN'
  if (now > dateClosed) status = 'CLOSED';
  return status
});
const administrationStatusBadge = computed(() => administrationStatus.value.toLowerCase()); 

const speedDialItems = computed( () => {
  const items = [];

  if (props.isSuperAdmin) {
    items.push({
    label: 'Delete',
    icon: 'pi pi-trash',
    command: (event) => {
      confirm.require({
        target: event.originalEvent.currentTarget,
        message: 'Are you sure you want to delete this administration?',
        icon: 'pi pi-exclamation-triangle',
        accept: async () => {
          await deleteAdministration(props.id);

          toast.add({
            severity: TOAST_SEVERITIES.INFO,
            summary: 'Confirmed',
            detail: `Deleted administration ${props.title}`,
            life: TOAST_DEFAULT_LIFE_DURATION,
          });
        },
        reject: () => {
          toast.add({
            severity: TOAST_SEVERITIES.ERROR,
            summary: 'Rejected',
            detail: `Failed to delete administration ${props.title}`,
            life: TOAST_DEFAULT_LIFE_DURATION,
          });
        },
      });
    },})
  }

  items.push({
    label: 'Edit',
    icon: 'pi pi-pencil',
    command: () => {
      router.push({ name: 'EditAdministration', params: { adminId: props.id } });
    },
  })

  return items;

});

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

const showTable = ref(false);
const enableQueries = ref(false);

onMounted(() => {
  enableQueries.value = true;
  showTable.value = !showTable.value;
});

const isWideScreen = computed(() => {
  return window.innerWidth > 768;
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const { data: orgs, isLoading: isLoadingDsgfOrgs } = useDsgfOrgQuery(props.id, props.assignees, {
  enabled: enableQueries,
});

const loadingTreeTable = computed(() => {
  return isLoadingDsgfOrgs.value || expanding.value;
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
  if (node.data.orgType === SINGULAR_ORG_TYPES.SCHOOLS && node.children?.length > 0 && !node.data.expanded) {
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
        const { collection = FIRESTORE_COLLECTIONS.CLASSES, ...nodeData } = orgDoc ?? {};

        if (_isEmpty(nodeData)) return undefined;

        return {
          key: `${node.key}-${index}`,
          data: {
            orgType: SINGULAR_ORG_TYPES[collection.toUpperCase()],
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
    // TODO: This fails currently as it tries to set a read only reactive handler
    // Specifically, setting the `children` key fails because the
    // schoolNode target is read-only.
    // Also, I'm pretty sure this is useless now because all classes will have stats
    // due to preallocation of accounts.
    for (const districtNode of newNodes ?? []) {
      for (const schoolNode of districtNode?.children ?? []) {
        if (schoolNode.children) {
          schoolNode.children = schoolNode.children.toSorted((a, b) => {
            if (!a.data.stats) return 1;
            if (!b.data.stats) return -1;
            return a.data.name.localeCompare(b.data.name);
          });
        }
      }
    }

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
.p-treetable-header-cell {
  display: none;
}
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

.card-admin-assessments {
  margin-top: 10px;
}

.p-dataview-paginator-top {
  border-bottom: 0px solid transparent!important;
}

.card-administration {
  text-align: left;
  width: 100%;
  background: var(--surface-b);
  border: 1px solid var(--primary-color);
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

.status-badge {
  font-weight: bold;
  font-family: var(--font-family);
  padding: 0.2rem 0.5rem;
  border-radius: var(--p-border-radius-xl);
  font-size: 0.8rem;
  margin-left: 0.8rem;

  &.open {
    background-color: var(--green-100);
    color: var(--green-800);
  }

  &.closed {
    background-color: var(--gray-300);
    color: var(--red-900);
  }
}

.h2-card-admin-title {
  float: left;
}
</style>
