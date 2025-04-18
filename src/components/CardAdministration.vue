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
            :tooltip-options="{ position: 'top', event: 'hover' }"
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
            <span>{{ tasksDictionary?.[assessmentId]?.name ?? assessmentId }}</span>
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
          <PvPopover v-for="assessmentId in assessmentIds" :key="assessmentId" :ref="(el) => { paramPanelRefs[assessmentId].value = el }">
            <div v-if="getAssessment(assessmentId)?.variantId">
              Variant ID: {{ getAssessment(assessmentId)?.variantId }}
            </div>
            <div v-if="getAssessment(assessmentId)?.variantName">
              Variant Name: {{ getAssessment(assessmentId)?.variantName }}
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

<script setup lang="ts">
import { computed, onMounted, ref, watch, Ref } from 'vue';
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
import type { TreeNode } from 'primevue/treenode';
import type { MenuItem } from 'primevue/menuitem';
import type { ChartData, ChartOptions } from 'chart.js';
// @ts-ignore
import { batchGetDocs } from '@/helpers/query/utils';
// @ts-ignore
import { taskDisplayNames } from '@/helpers/reports';
// @ts-ignore
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import useDsgfOrgQuery from '@/composables/queries/useDsgfOrgQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import useDeleteAdministrationMutation from '@/composables/mutations/useDeleteAdministrationMutation';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { TOAST_SEVERITIES, TOAST_DEFAULT_LIFE_DURATION } from '@/constants/toasts';
// @ts-ignore
import { isLevante } from '@/helpers';

interface TaskDisplayInfo {
  name: string;
  order: number;
}

interface AssessmentParam {
  key: string;
  value: any;
}

interface Assessment {
  taskId: string;
  variantId?: string;
  variantName?: string;
  params: Record<string, any>;
}

interface Dates {
  start: string | number | Date;
  end: string | number | Date;
}

type OrgTypeValue = typeof SINGULAR_ORG_TYPES[keyof typeof SINGULAR_ORG_TYPES];

interface OrgNodeData {
  id: string;
  name: string;
  orgType: OrgTypeValue;
  stats?: {
    assignment?: {
      assigned?: number;
      started?: number;
      completed?: number;
    };
  };
  districtId?: string;
  expanded?: boolean;
  [key: string]: any;
}

interface OrgTreeNode extends TreeNode {
  key: string;
  data?: OrgNodeData;
  children?: OrgTreeNode[];
}

interface CardAdministrationProps {
  id: string;
  title: string;
  publicName: string;
  stats?: {
    total?: {
      assignment?: {
        assigned?: number;
        started?: number;
        completed?: number;
      };
    };
  };
  dates: Dates;
  assignees: Record<string, any>;
  assessments: Assessment[];
  showParams: boolean;
  isSuperAdmin: boolean;
}

const props = defineProps<CardAdministrationProps>();

const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const { mutateAsync: deleteAdministration } = useDeleteAdministrationMutation();

const showTable = ref<boolean>(false);
const enableQueries = ref<boolean>(false);
const expanding = ref<boolean>(false);
const treeTableOrgs = ref<OrgTreeNode[]>([]);
const doughnutChartData = ref<ChartData<'doughnut'> | undefined>();
const doughnutChartOptions = ref<ChartOptions<'doughnut'> | undefined>();

const paramPanelRefs: Record<string, Ref<any>> = _fromPairs(
  props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), ref<any>(null)])
);

const administrationStatus = computed<string>(() => {
  const now = new Date();
  const dateClosed = new Date(props.dates.end);
  if (isNaN(dateClosed.getTime())) return 'INVALID DATE';
  return now > dateClosed ? 'CLOSED' : 'OPEN';
});

const administrationStatusBadge = computed<string>(() => administrationStatus.value.toLowerCase());

const speedDialItems = computed<MenuItem[]>(() => [
  {
    label: 'Delete',
    icon: 'pi pi-trash',
    command: (event: { originalEvent: Event }) => {
      confirm.require({
        target: event.originalEvent.currentTarget as HTMLElement,
        message: 'Are you sure you want to delete this administration?',
        icon: 'pi pi-exclamation-triangle',
        accept: async () => {
          try {
            await deleteAdministration(props.id);
            toast.add({
              severity: TOAST_SEVERITIES.INFO,
              summary: 'Confirmed',
              detail: `Deleted administration ${props.title}`,
              life: TOAST_DEFAULT_LIFE_DURATION,
            });
          } catch (error: any) {
            console.error("Failed to delete administration:", error);
            toast.add({
              severity: TOAST_SEVERITIES.ERROR,
              summary: 'Error',
              detail: `Failed to delete administration ${props.title}.`,
              life: TOAST_DEFAULT_LIFE_DURATION,
            });
          }
        },
        reject: () => {
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

const processedDates = computed<{ start: Date; end: Date }>(() => {
  const startDate = props.dates.start ? new Date(props.dates.start) : new Date(NaN);
  const endDate = props.dates.end ? new Date(props.dates.end) : new Date(NaN);
  return { start: startDate, end: endDate };
});

const typedTaskDisplayNames = taskDisplayNames as Record<string, TaskDisplayInfo>;

const assessmentIds = computed<string[]>(() => props.assessments
  .map((assessment) => assessment.taskId.toLowerCase())
  .sort((p1, p2) => {
    const order1 = typedTaskDisplayNames[p1 as keyof typeof typedTaskDisplayNames]?.order ?? Infinity;
    const order2 = typedTaskDisplayNames[p2 as keyof typeof typedTaskDisplayNames]?.order ?? Infinity;
    return order1 - order2;
  }));

const params = computed<Record<string, Record<string, any>>>(() =>
  _fromPairs(props.assessments.map((assessment) => [assessment.taskId.toLowerCase(), assessment.params]))
);

const isWideScreen = computed<boolean>(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth > 768;
  }
  return false;
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const { data: orgs, isLoading: isLoadingDsgfOrgs } = useDsgfOrgQuery(props.id, props.assignees, {
  enabled: enableQueries,
}) as { data: Ref<OrgTreeNode[] | undefined>; isLoading: Ref<boolean> };

const loadingTreeTable = computed<boolean>(() => {
  return isLoadingDsgfOrgs.value || expanding.value;
});

watch(orgs, (newValue) => {
  if (newValue) {
    treeTableOrgs.value = newValue;
  } else {
    treeTableOrgs.value = [];
  }
});

watch(showTable, (newValue) => {
  if (newValue && orgs.value) {
    treeTableOrgs.value = orgs.value;
  }
});

const toEntryObjects = (inputObj: Record<string, any> | undefined | null): AssessmentParam[] => {
  if (!inputObj) return [];
  return _toPairs(inputObj).map(([key, value]) => ({ key, value }));
};

const toggleParams = (event: Event, id: string) => {
  const popoverInstance = paramPanelRefs[id]?.value;
  if (popoverInstance) {
    (popoverInstance as any).toggle(event);
  } else {
    console.warn(`Popover ref for id '${id}' not found or missing toggle method.`);
  }
};

function getAssessment(assessmentId: string): Assessment | undefined {
  return props.assessments.find((assessment) => assessment.taskId.toLowerCase() === assessmentId);
}

const onExpand = async (event: any) => {
  const node = event.node as OrgTreeNode;
  if (!node.data || !node.key) return;

  if (node.data.orgType === SINGULAR_ORG_TYPES.SCHOOLS && node.children?.length && !node.data.expanded) {
    expanding.value = true;

    const validChildren = (node.children || []).filter((child): child is OrgTreeNode & { data: { id: string } } => !!child?.data?.id);
    const classPaths = validChildren.map(({ data }) => `classes/${data!.id}`);
    const statPaths = validChildren.map(({ data }) => `administrations/${props.id}/stats/${data!.id}`);

    try {
      const classPromises = [
        batchGetDocs(classPaths, ['name', 'schoolId']),
        batchGetDocs(statPaths)
      ];

      const [classDocs, classStats] = await Promise.all(classPromises);

      const lazyNode: OrgTreeNode = {
        ...node,
        key: String(node.key),
        data: {
          ...node.data,
          expanded: true,
        },
        children: [],
      };

      const zippedData: [any | undefined, any | undefined][] = _zip(classDocs, classStats);

      const childNodes: OrgTreeNode[] = _without(
        zippedData.map(([orgDoc, stats], index): OrgTreeNode | undefined => {
          const { collection = FIRESTORE_COLLECTIONS.CLASSES, ...nodeData } = orgDoc ?? {};

          if (_isEmpty(nodeData) || !nodeData.id) return undefined;

          const orgTypeKey = String(collection).toUpperCase() as keyof typeof SINGULAR_ORG_TYPES;
          const childData: OrgNodeData = {
            id: nodeData.id,
            name: nodeData.name ?? 'Unknown Class',
            orgType: SINGULAR_ORG_TYPES[orgTypeKey] ?? 'UNKNOWN',
            stats: stats ?? undefined,
            districtId: nodeData.schoolId,
          };

          return {
            key: `${String(node.key)}-${index}`,
            data: childData,
          };
        }),
        undefined
      ).filter((n): n is OrgTreeNode => n !== undefined);

      lazyNode.children = childNodes;

      if (lazyNode.children) {
        lazyNode.children = [...lazyNode.children].sort((a, b) => {
          const statsA = a.data?.stats;
          const statsB = b.data?.stats;
          const nameA = a.data?.name ?? '';
          const nameB = b.data?.name ?? '';

          if (!statsA && statsB) return 1;
          if (statsA && !statsB) return -1;
          return nameA.localeCompare(nameB);
        });
      }

      treeTableOrgs.value = treeTableOrgs.value.map((n) => {
        if (!n.data) return n;

        if (n.data.id === node.data?.districtId && n.children) {
          const newChildren = n.children.map((child) => {
            if (child.data?.id === node.data?.id) {
              return lazyNode;
            }
            return child;
          });
          return { ...n, children: newChildren };
        } else if (n.data.id === node.data?.id) {
          return lazyNode;
        }
        return n;
      });

    } catch (error: any) {
      console.error("Error expanding node:", error);
      toast.add({ severity: 'error', summary: 'Error', detail: 'Could not load data.', life: 3000 });
    } finally {
      expanding.value = false;
    }
  }
};

const setDoughnutChartOptions = (): ChartOptions<'doughnut'> => ({
  cutout: '60%',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
    },
  },
  responsive: true,
  maintainAspectRatio: false,
});

const setDoughnutChartData = (): ChartData<'doughnut'> | undefined => {
  const statsTotalAssignment = props.stats?.total?.assignment;
  if (!statsTotalAssignment) {
    return undefined;
  }

  const docStyle = getComputedStyle(document.documentElement);
  let { assigned = 0, started = 0, completed = 0 } = statsTotalAssignment;

  const numCompleted = Number(completed);
  let numStarted = Number(started) - numCompleted;
  let numAssigned = Number(assigned) - numStarted - numCompleted;

  numStarted = Math.max(0, numStarted);
  numAssigned = Math.max(0, numAssigned);

  return {
    labels: ['Completed', 'Started', 'Assigned'],
    datasets: [
      {
        data: [numCompleted, numStarted, numAssigned],
        backgroundColor: [
          docStyle.getPropertyValue('--bright-green') || '#22C55E',
          docStyle.getPropertyValue('--yellow-100') || '#FFF9C4',
          docStyle.getPropertyValue('--surface-d') || '#dee2e6',
        ],
      },
    ],
  };
};

onMounted(() => {
  enableQueries.value = true;

  if (props.stats?.total?.assignment) {
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
  border: 1px solid var(--gray-300);
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
