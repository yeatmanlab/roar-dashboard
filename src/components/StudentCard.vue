<template>
  <article class="flex overflow-hidden rounded border-gray-200 flex-column border-1 mx-auto w-full max-w-3xl">
    <div class="flex gap-2 p-3 bg-gray-100 flex-column">
      <h2 class="m-0 text-xl font-bold">
        {{ userName }}
        <div class="text-sm font-light">Student</div>
      </h2>
      <div class="flex gap-4 mt-2 font-normal text-gray-500">
        <div class="text-sm">
          {{ getGradeToDisplay(userData?.studentData?.grade) }}
        </div>
        <div class="text-sm">
          {{ _capitalize(userData?.studentData?.schoolLevel) }}
          <span class="">School</span>
        </div>
      </div>
    </div>
    <div class="p-2 mt-3 flex justify-content-between align-items-center">
      <h3 class="m-0 text-md font-semibold text-gray-500">Assignments</h3>
      <PvButton
        outlined
        class="text-black border-1 border-round h-2rem p-2"
        :label="!expanded ? 'Expand All' : 'Collapse All'"
        :icon="!expanded ? 'pi pi-plus ml-2' : 'pi pi-minus ml-2'"
        icon-pos="right"
        size="small"
        @click="setExpand"
      />
    </div>

    <div class="flex flex-column gap-2 mb-3 p-2">
      <div class="flex justify-content-between align-items-center">
        <div class="text-sm text-gray-400">Sort by</div>
        <PvSelect v-model="sortKey" :options="sortOptions" option-label="label" class="w-auto" @change="onSortChange" />
      </div>
    </div>

    <PvDataView
      :value="sortedAssignments"
      paginator
      :rows="5"
      :rows-per-page-options="[5, 10]"
      :sort-order="sortOrder"
      :sort-field="sortField"
    >
      <template #list="slotProps">
        <div class="w-full flex flex-column gap-3 px-2">
          <div
            v-for="assignment in slotProps.items"
            :key="assignment.id"
            class="border-1 border-gray-200 rounded-lg overflow-hidden"
          >
            <PvAccordion
              :multiple="true"
              :active-index="activeIndices"
              collapse-icon="pi pi-minus"
              expand-icon="pi pi-plus"
            >
              <PvAccordionTab>
                <template #header>
                  <div class="flex justify-between w-full">
                    <div>
                      <div class="text-md">{{ assignment.name }}</div>
                      <div class="mt-1 text-xs font-light">Assignment</div>
                    </div>
                    <div>
                      <div class="mt-1 text-sm">
                        {{ parseDate(assignment.dateOpened) }} - {{ parseDate(assignment.dateClosed) }}
                      </div>
                      <div class="mt-1 text-xs font-light text-end">Dates Active</div>
                    </div>
                  </div>
                </template>
                <div class="flex gap-3 flex-column p-3">
                  <div class="flex gap-4 justify-content-between">
                    <PvButton
                      label="Play Games"
                      data-cy="play-assessments-btn"
                      :on-click="() => setSelectedAdminAndLaunchStudent(assignment)"
                    />
                    <router-link
                      :to="{
                        name: 'StudentReport',
                        params: {
                          administrationId: assignment.id,
                          orgType: props.orgType,
                          orgId: props.orgId,
                          userId: userId,
                        },
                      }"
                      class="text-black no-underline"
                    >
                      <PvButton
                        label="View Scores"
                        icon=""
                        outlined
                        severity="contrast"
                        data-cy="view-score-report-btn"
                      />
                    </router-link>
                  </div>

                  <div class="flex gap-3 mt-3 flex-column">
                    <h4 class="m-0 font-semibold text-md">Progress</h4>
                    <div class="flex gap-1 flex-column">
                      <div
                        v-for="assessment in assignment.assessments"
                        :key="assessment.taskId"
                        class="flex justify-between text-sm align-items-center"
                      >
                        <div>{{ taskDisplayNames[assessment.taskId]?.publicName }}</div>
                        <div>
                          <PvTag
                            :severity="getAssessmentStatus(assessment).severity"
                            :value="getAssessmentStatus(assessment).value"
                            :icon="getAssessmentStatus(assessment).icon"
                            class="p-0.5 m-0 font-semibold capitalize"
                            :style="`min-width: 2rem;`"
                            rounded
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </PvAccordionTab>
            </PvAccordion>
          </div>
        </div>
      </template>
    </PvDataView>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue';
import { taskDisplayNames, getGradeToDisplay, progressTags } from '@/helpers/reports.js';
import _capitalize from 'lodash/capitalize';
import _orderBy from 'lodash/orderBy';
import PvTag from 'primevue/tag';
import PvButton from 'primevue/button';
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';
import PvDataView from 'primevue/dataview';
import PvSelect from 'primevue/select';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import { useGameStore } from '@/store/game';
import { storeToRefs } from 'pinia';
import router from '@/router/index.js';

const gameStore = useGameStore();
const { selectedAdmin } = storeToRefs(gameStore);

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Date Opened', value: 'dateOpened' },
  { label: 'Date Closed', value: 'dateClosed' },
];

const sortKey = ref(sortOptions[0]);
const sortOrder = ref(1);
const sortField = ref('name');
const expanded = ref(false);

const activeIndices = computed(() => {
  if (!expanded.value) return [];
  return sortedAssignments.value?.map((_, index) => index) || [];
});

const onSortChange = (event) => {
  sortField.value = event.value.value;
  sortOrder.value = 1;
};

const setExpand = () => {
  expanded.value = !expanded.value;
};

const sortedAssignments = computed(() => {
  // For dateOpened, we want ascending order (earliest to latest) when sortOrder is 1
  const order =
    sortField.value === 'dateOpened'
      ? sortOrder.value === 1
        ? 'asc'
        : 'desc'
      : sortOrder.value === 1
      ? 'desc'
      : 'asc';
  return _orderBy(Object.values(props.assignments), [sortField.value], [order]);
});

// method to set selectedAdmin to assignment passed in on button click
const setSelectedAdminAndLaunchStudent = (assignment) => {
  selectedAdmin.value = assignment;

  router.push({
    name: 'LaunchParticipant',
    params: { launchId: props.userId },
  });
};

const getAssessmentStatus = (assessment) => {
  if (assessment.completedOn) {
    return progressTags.Completed;
  }
  if (assessment.startedOn) {
    return progressTags.Started;
  }
  return progressTags.Assigned;
};

const props = defineProps({
  assignments: { type: Object, required: true },
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  userId: { type: String, required: true },
});

const { data: userData } = useUserDataQuery(props.userId);

const userName = computed(() => {
  if (!userData.value) return '';
  const { first, last } = userData.value?.name || {};
  if (first && last) {
    return `${first} ${last}`;
  }

  return first || userData.value?.username;
});

const parseDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US');
};
</script>
