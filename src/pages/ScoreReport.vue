<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel :header="`Administration Score Report: ${administrationInfo.name}`">
        <template #icons>
          <button class="p-panel-header-icon p-link mr-2" @click="refresh">
            <span :class="spinIcon"></span>
          </button>
        </template>

        <h2 v-if="orgInfo">{{ orgInfo.name }} Score Report</h2>

        <!-- Header blurbs about tasks -->
        <h2>In this Report...</h2>
        <span>You will receive a breakdown of your classroom's ROAR scores across each of the domains tested. </span>
        <div v-if="allTasks.includes('pa')">
          <span class="task-header">ROAR-Phonological Awareness (ROAR-Phoneme)</span> assesses some of the most foundational skills for reading: mapping letters to their corresponding sounds. This skill is crucial for building further reading fluency skills, such as decoding.
        </div>
        <div v-if="allTasks.includes('swr')">
          <span class="task-header">ROAR-Single Word Recognition (ROAR-Word)</span> assesses decoding skills at the word level.
        </div>
        <div v-if="allTasks.includes('sre')">
          <span class="task-header">ROAR-Sentence Reading Efficiency (ROAR-Sentence)</span> assesses reading fluency at the sentence level. 
        </div>


        <!-- Loading data spinner -->
        <div v-if="refreshing" class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span>Loading Administration Data</span>
        </div>

        <!-- Main table -->
        <RoarDataTable v-else :data="tableData" :columns="columns" />

        <div class="legend-container">
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${emptyTagColorMap.below};`"/>
            <div>
              <div>Needs extra support</div>
              <div>(Below 25th percentile)</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${emptyTagColorMap.some};`"/>
            <div>
              <div>Needs some support</div>
              <div>(Below 50th percentile)</div>
            </div>
          </div>
          <div class="legend-entry">
            <div class="circle" :style="`background-color: ${emptyTagColorMap.above};`"/>
            <div>
              <div>At or above average</div>
              <div>(At or above 50th percentile)</div>
            </div>
          </div>
        </div>
        <div style="text-align: center;">Students are classified into three support groups based on nationally-normed percentiles. Blank spaces indicate that the assessment was not completed.</div>

        <!-- In depth breakdown of each task-->
        <div v-if="allTasks.includes('pa')" class="task-card">
          <div class="task-title">ROAR-PHENOME</div>
          <span style="text-transform: uppercase;">Phonological Awareness</span>
          <p class="task-description">ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in overall reading proficiency. </p>
        </div>
        <div v-if="allTasks.includes('swr')" class="task-card">
          <div class="task-title">ROAR-WORD</div>
          <span style="text-transform: uppercase;">Single Word Recognition</span>
          <p class="task-description">ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. </p>
        </div>
        <div v-if="allTasks.includes('sre')" class="task-card">
          <div class="task-title">ROAR-SENTENCE</div>
          <span style="text-transform: uppercase;">Sentence Reading Efficiency</span>
          <p class="task-description">ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort.</p>
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _get from 'lodash/get'
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "@/router/sidebarActions";

const authStore = useAuthStore();
const queryStore = useQueryStore();

const { getAdministrationInfo, getOrgInfo } = storeToRefs(queryStore);
const orgInfo = ref(getOrgInfo.value(props.orgType, props.orgId));
const administrationInfo = ref(getAdministrationInfo.value(props.administrationId));

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin(), true));

const props = defineProps({
  administrationId: String,
  orgType: String,
  orgId: String,
});

const refreshing = ref(true);
const spinIcon = computed(() => {
  if (refreshing.value) return "pi pi-spin pi-spinner";
  return "pi pi-refresh";
});

const assignmentData = ref([]);

const allTasks = computed(() => {
  if(tableData.value.length > 0) {
    return tableData.value[0].assignment.assessments.map(assessment => assessment.taskId)
  } else return []
})

const emptyTagColorMap = {
  above: 'green',
  some: '#edc037',
  below: '#c93d82'
}

const columns = computed(() => {
  const tableColumns = [
    { field: "user.username", header: "Username", dataType: "text" },
    { field: "user.assessmentPid", header: "PID", dataType: "text" },
    { field: "user.studentData.grade", header: "Grade", dataType: "text" },
  ];

  if (tableData.value.length > 0) {
    for (const taskId of allTasks.value) {
      tableColumns.push({
        field: `scores.${taskId}.value`,
        header: taskId.toUpperCase(),
        dataType: "text",
        emptyTag: true,
        tagColor: `scores.${taskId}.color`,
      });
    }
  }
  return tableColumns;
});

const tableData = computed(() => {
  return assignmentData.value.map(({ user, assignment }) => {
    const status = {};
    const scores = {};
    for (const assessment of (assignment?.assessments || [])) {
      let percentileScore = undefined;
      if(assessment.taskId === "swr") {
        percentileScore = _get(assessment, 'scores.computed.composite.wjPercentile')
      }
      if(assessment.taskId === "sre") {
        percentileScore = _get(assessment, 'scores.computed.composite.tosrecPercentile')
      }
      if(percentileScore !== undefined){
        let support_level = '';
        let tag_color = '';
        if(percentileScore >= 50) {
          support_level = 'at_above'
          tag_color = emptyTagColorMap.above;
        } else if(percentileScore > 25 && percentileScore < 50) {
          support_level = 'some_support'
          tag_color = emptyTagColorMap.some
        } else {
          support_level = "needs_extra"
          tag_color = emptyTagColorMap.below
        }
        console.log('swr score', percentileScore)
        scores[assessment.taskId] = {
          score: percentileScore,
          support_level,
          color: tag_color
        }
      }
      // if (assessment.completedOn !== undefined) {
      //   status[assessment.taskId] = {
      //     value: "completed",
      //     icon: "pi pi-check",
      //     severity: "success",
      //   };
      // } else if (assessment.startedOn !== undefined) {
      //   status[assessment.taskId] = {
      //     value: "started",
      //     icon: "pi pi-exclamation-triangle",
      //     severity: "warning",
      //   };
      // } else {
      //   status[assessment.taskId] = {
      //     value: "assigned",
      //     icon: "pi pi-times",
      //     severity: "danger",
      //   };
      // }
    }
    return {
      user,
      assignment,
      status,
      scores,
    }
  });
})

let unsubscribe;

const refresh = async () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  assignmentData.value = await queryStore.getUsersByAssignment(
    props.administrationId, props.orgType, props.orgId, true
  );

  if (!orgInfo.value) {
    queryStore.getAdminOrgs();
    orgInfo.value = getOrgInfo.value(props.orgType, props.orgId);
  }
  if (!administrationInfo.value) {
    administrationInfo.value = getAdministrationInfo.value(props.administrationId);
  }

  refreshing.value = false;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.getUsersByAssignment && state.roarfirekit.isAdmin()) {
    await refresh();
  }
});

const { roarfirekit } = storeToRefs(authStore);
onMounted(async () => {
  if (roarfirekit.value.getUsersByAssignment) {
    await refresh()
  }
})
</script>

<style>
.p-button {
  margin: 0px 8px;
}
.task-header {
  font-weight: bold;
}
.task-card {
  background: #f6f6fe;
  padding: 2rem;
  text-align: center;
  margin-bottom: 1rem;
}
.task-title {
  font-size: 3.5rem;
  /* font-weight: bold; */
}
.task-description {
  font-size: 1.25rem;
  text-align: left;
}
.legend-container {
  display: flex;
  flex-direction: row;
  gap: 3vw;
  justify-content: center;
  margin-top: 3rem;
}
.legend-entry {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.circle {
  border-color: white;
  display: inline-block;
  border-radius: 50%;
  border-width: 5px;
  height: 25px;
  width: 25px;
  vertical-align: middle;
  margin-right: 10px;
}
</style>
