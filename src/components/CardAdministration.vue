<template>
  <div class="p-card card-administration mb-4 w-full">
    <div v-if="props.stats && isSuperAdmin" class="card-admin-chart">
      <PvChart type="doughnut" :data="doughnutChartData" :options="doughnutChartOptions" />
    </div>
    <div class="card-admin-body w-full">
      <div class="flex flex-row w-full md:h-2rem sm:h-3rem">
        <div class="flex-grow-1 pr-3 mr-2 p-0 m-0">
          <h2 data-cy="h2-card-admin-title" class="sm:text-lg lg:text-lx m-0 h2-card-admin-title">
            {{ title }}
          </h2>
          <small v-if="Object.keys(props.creator).length" class="m-0 ml-1">
            — Created by <span class="font-bold">{{ props.creator?.displayName }}</span></small
          >
        </div>
        <div class="flex justify-content-end w-3">
          <PvSpeedDial
            :action-button-props="{
              rounded: true,
              severity: 'danger',
              variant: 'outlined',
            }"
            :button-props="{
              rounded: true,
              severity: 'danger',
              variant: 'outlined',
            }"
            :model="speedDialItems"
            :tooltip-options="{
              event: 'hover',
              position: 'top',
            }"
            :transition-delay="80"
            class="administration-action"
            direction="left"
            hide-icon="pi pi-times"
            show-icon="pi pi-cog"
          />
          <PvConfirmPopup />
        </div>
      </div>
      <div class="card-admin-details">
        <span class="mr-1"><strong>Availability</strong>:</span>
        <span>
          {{ processedDates.start.toLocaleDateString() }} —
          {{ processedDates.end.toLocaleDateString() }}
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
              style="font-size: 0.8rem"
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
              class="h-2rem w-full m-0 mt-2 p-0"
            />
          </template>
        </PvColumn>
        <PvColumn field="id" header="" style="width: 14rem">
          <template #body="{ node }">
            <div v-if="node.data.id" class="flex m-0">
              <router-link
                :to="{
                  name: 'ProgressReport',
                  params: {
                    administrationId: props.id,
                    orgId: node.data.id,
                    orgType: node.data.orgType,
                  },
                }"
                class="no-underline text-black"
              >
                <PvButton
                  v-tooltip.top="'See completion details'"
                  class="m-0 bg-transparent text-bluegray-500 shadow-none border-none p-0 border-round"
                  style="color: var(--primary-color) !important"
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
                  params: {
                    administrationId: props.id,
                    orgId: node.data.id,
                    orgType: node.data.orgType,
                  },
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

<script setup lang="ts">
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

interface Assessment {
  taskId: string;
  variantId?: string;
  variantName?: string;
  params: Record<string, any>;
}

interface Stats {
  assignment?: {
    assigned?: number;
    started?: number;
    completed?: number;
  };
}

interface Dates {
  start: string | Date;
  end: string | Date;
}

interface Assignees {
  [key: string]: any;
}

interface Props {
  id: string;
  title: string;
  publicName: string;
  stats?: {
    total?: Stats;
  };
  dates: Dates;
  assignees: Assignees;
  assessments: Assessment[];
  showParams: boolean;
  isSuperAdmin: boolean;
  creator?: any;
}

interface SpeedDialItem {
  label: string;
  icon: string;
  command: (event?: any) => void;
}

interface TreeNode {
  key: string;
  data: {
    id?: string;
    name?: string;
    orgType?: string;
    districtId?: string;
    schoolId?: string;
    stats?: Stats;
    expanded?: boolean;
  };
  children?: TreeNode[];
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
    backgroundColor: string[];
  }>;
}

interface ChartOptions {
  cutout: string;
  showToolTips: boolean;
  plugins: {
    legend: {
      display: boolean;
    };
    tooltip: {
      enabled: boolean;
    };
  };
}

const router = useRouter();

const props = withDefaults(defineProps<Props>(), {
  creator: {},
  stats: () => ({}),
});

const confirm = useConfirm();
const toast = useToast();

const { mutateAsync: deleteAdministration } = useDeleteAdministrationMutation();

const administrationStatus = computed((): string => {
  const now = new Date();
  const dateClosed = new Date(props.dates.end);
  let status = 'OPEN';
  if (now > dateClosed) status = 'CLOSED';
  return status;
});

const administrationStatusBadge = computed((): string => administrationStatus.value.toLowerCase());

const speedDialItems = computed((): SpeedDialItem[] => {
  const items: SpeedDialItem[] = [];

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
      },
    });
  }

  items.push({
    label: 'Edit',
    icon: 'pi pi-pencil',
    command: () => {
      router.push({
        name: 'EditAdministration',
        params: { adminId: props.id },
      });
    },
  });

  return items;
});

const processedDates = computed(() => {
  return _mapValues(props.dates, (date) => {
    return new Date(date);
  });
});

const assessmentIds: string[] = props.assessments
  .map((assessment) => assessment.taskId.toLowerCase())
  .sort((p1, p2) => {
    return ((taskDisplayNames as any)[p1]?.order ?? 0) - ((taskDisplayNames as any)[p2]?.order ?? 0);
  });

const paramPanelRefs: Record<string, any> = _fromPairs(
  props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), ref()]),
);

const params: Record<string, Record<string, any>> = _fromPairs(
  props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), assessment.params]),
);

const toEntryObjects = (inputObj: Record<string, any>): Array<{ key: string; value: any }> => {
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
};

const toggleParams = (event: Event, id: string): void => {
  paramPanelRefs[id].value[0].toggle(event);
};

function getAssessment(assessmentId: string): Assessment | undefined {
  return props.assessments.find((assessment) => assessment.taskId.toLowerCase() === assessmentId);
}

const showTable = ref<boolean>(false);
const enableQueries = ref<boolean>(false);

onMounted((): void => {
  enableQueries.value = true;
  showTable.value = !showTable.value;
});

const isWideScreen = computed((): boolean => {
  return window.innerWidth > 768;
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const { data: orgs, isLoading: isLoadingDsgfOrgs } = useDsgfOrgQuery(props.id, props.assignees, {
  enabled: enableQueries,
});

const loadingTreeTable = computed((): boolean => {
  return isLoadingDsgfOrgs.value || expanding.value;
});

const treeTableOrgs = ref<TreeNode[]>([]);
watch(orgs, (newValue) => {
  treeTableOrgs.value = newValue || [];
});

watch(showTable, (newValue) => {
  if (newValue) treeTableOrgs.value = orgs.value || [];
});

const expanding = ref<boolean>(false);
const onExpand = async (node: TreeNode): Promise<void> => {
  if (
    node.data.orgType === SINGULAR_ORG_TYPES.SCHOOLS &&
    node.children &&
    node.children.length > 0 &&
    !node.data.expanded
  ) {
    expanding.value = true;

    const classPaths = node.children.map(({ data }) => `classes/${data.id}`);
    const statPaths = node.children.map(({ data }) => `administrations/${props.id}/stats/${data.id}`);

    const classPromises = [batchGetDocs(classPaths, ['name', 'schoolId']), batchGetDocs(statPaths)];

    const [classDocs, classStats] = await Promise.all(classPromises);

    // Lazy node is a copy of the expanding node. We will insert more detailed
    // children nodes later.
    const lazyNode: TreeNode = {
      key: node.key,
      data: {
        ...node.data,
        expanded: true,
      },
    };

    const childNodes = _without(
      _zip(classDocs, classStats).map(([orgDoc, stats], index) => {
        if (!orgDoc) return undefined;

        const { collection = FIRESTORE_COLLECTIONS.CLASSES, ...nodeData } = orgDoc;

        if (_isEmpty(nodeData)) return undefined;

        return {
          key: `${node.key}-${index}`,
          data: {
            orgType: (SINGULAR_ORG_TYPES as any)[collection.toUpperCase()],
            ...(stats && { stats }),
            ...nodeData,
          },
        };
      }),
      undefined,
    ).filter((node): node is TreeNode => node !== undefined);

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
          children: n.children?.map((child) => {
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
            return (a.data.name || '').localeCompare(b.data.name || '');
          });
        }
      }
    }

    treeTableOrgs.value = newNodes;
    expanding.value = false;
  }
};

const doughnutChartData = ref<ChartData>();
const doughnutChartOptions = ref<ChartOptions>();

const setDoughnutChartOptions = (): ChartOptions => ({
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

const setDoughnutChartData = (): ChartData => {
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

onMounted((): void => {
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
  border-bottom: 0px solid transparent !important;
}

.card-administration {
  text-align: left;
  width: 100%;
  background: var(--surface-b);
  border: 1px solid var(--gray-200);
  border-radius: calc(var(--border-radius) * 4);
  display: flex;
  flex-direction: row;
  gap: 2rem;
  padding: 2rem;
  overflow-y: hidden;
  overflow-x: auto;

  .card-admin-chart {
    width: 12ch;
    @media (max-width: 768px) {
      display: none;
    }
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

  &:not(:last-of-type):after {
    content: ', ';
  }
}

.card-admin-details {
  display: flex;
  justify-content: start;
  align-items: center;
}

.status-badge {
  font-weight: bold;
  font-family: var(--font-family);
  padding: 0.25rem 0.5rem;
  border-radius: var(--p-border-radius-xl);
  font-size: 0.7rem;
  margin: 0 0 0 0.8rem;

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
  font-weight: bold;

  @media (max-width: 768px) {
    font-size: 1.1rem;
  }
}

.administration-action {
  display: flex;
  justify-content: end;
  align-items: center;

  .p-speeddial-item {
    width: 2rem;
    height: 2rem;
    margin: 0;
    padding: 0;

    .p-button {
      display: flex;
      width: 2rem;
      height: 2rem;
      margin: 0;
      padding: 0;
    }
  }

  &.p-speeddial-open {
    .p-speeddial-button {
      background: var(--primary-color);
      border: 1px solid var(--primary-color);
      color: white;

      &:hover {
        background: var(--primary-color-hover);
        border: 1px solid var(--primary-color-hover);
        color: white;
      }
    }
  }
}
</style>
