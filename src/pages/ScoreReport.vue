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

        <h2 v-if="orgInfo" class="report-title">{{ _toUpper(orgInfo.name) }} SCORE REPORT</h2>

        <!-- Header blurbs about tasks -->
        <h2>IN THIS REPORT...</h2>
        <span>You will receive a breakdown of your classroom's ROAR scores across each of the domains tested. </span>
        <div class="task-overview-container">
          <div v-if="allTasks.includes('pa')" class="task-blurb">
            <span class="task-header">ROAR-Phonological Awareness (ROAR-Phoneme)</span> assesses some of the most foundational skills for reading: mapping letters to their corresponding sounds. This skill is crucial for building further reading fluency skills, such as decoding.
          </div>
          <div v-if="allTasks.includes('swr') || allTasks.includes('swr-es')" class="task-blurb">
            <span class="task-header">ROAR-Single Word Recognition (ROAR-Word)</span> assesses decoding skills at the word level.
          </div>
          <div v-if="allTasks.includes('sre')" class="task-blurb">
            <span class="task-header">ROAR-Sentence Reading Efficiency (ROAR-Sentence)</span> assesses reading fluency at the sentence level. 
          </div>
        </div>


        <!-- Loading data spinner -->
        <div v-if="refreshing" class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span>Loading Administration Data</span>
        </div>

        <!-- Main table -->
        <div v-else>
          <div class="toggle-container">
            <span>Show percentiles</span>
            <InputSwitch v-model="showNumbers" class="ml-2"/>
          </div>
          <RoarDataTable :data="tableData" :columns="columns" />
        </div>
        

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
        <div class="legend-description">Students are classified into three support groups based on nationally-normed percentiles. Blank spaces indicate that the assessment was not completed.</div>

        <!-- In depth breakdown of each task-->
        <div v-if="allTasks.includes('pa')" class="task-card">
          <div class="task-title">ROAR-PHENOME</div>
          <span style="text-transform: uppercase;">Phonological Awareness</span>
          <p class="task-description">ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in overall reading proficiency. </p>
        </div>
        <div v-if="allTasks.includes('swr') || allTasks.includes('swr-es')" class="task-card">
          <div class="task-title">ROAR-WORD</div>
          <span style="text-transform: uppercase;">Single Word Recognition</span>
          <p class="task-description">ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. </p>
        </div>
        <div v-if="allTasks.includes('sre')" class="task-card">
          <div class="task-title">ROAR-SENTENCE</div>
          <span style="text-transform: uppercase;">Sentence Reading Efficiency</span>
          <p class="task-description">ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort.</p>
        </div>

        <div>
          <h2 class="extra-info-title">HOW ROAR SCORES INFORM PLANNING TO PROVIDE SUPPORT</h2>
          <p>Each foundational reading skill is a building block of the subsequent skill. Phonological awareness supports the development of word-level decoding skills. Word-level decoding supports sentence-reading fluency. Sentence-reading fluency supports reading comprehension. For students who need support in reading comprehension, their ROAR results can be used to inform the provision of support. </p>
          <ol>
            <li>Students who need support in all categories should begin with support in phonological awareness as the base of all other reading skills.</li>
            <li>Students who have phonological awareness skills but need support in single-word recognition would likely benefit from targeted instruction in decoding skills to improve accuracy.</li>
            <li>Students who have phonological awareness and word-decoding skills but need support in sentence-reading would likely benefit from sustained practice in reading for accuracy and fluency. These students demonstrate they can read at the word-level, but they do not appear to read quickly and accurately across the length of a sentence.</li>
          </ol>
          <!-- Reintroduce when we have somewhere for this link to go. -->
          <!-- <a href="google.com">Click here</a> for more guidance on steps you can take in planning to support your students. -->
        </div>
        <div>
          <h2 class="extra-info-title">NEXT STEPS</h2>
          <!-- Reintroduce when we have somewhere for this link to go. -->
          <!-- <p>This score report has provided a snapshot of your school's reading performance at the time of administration. By providing classifications for students based on national norms for scoring, you are able to see which students can benefit from varying levels of support. To read more about what to do to support your students, <a href="google.com">read here.</a></p> -->
          <p>This score report has provided a snapshot of your school's reading performance at the time of administration. By providing classifications for students based on national norms for scoring, you are able to see which students can benefit from varying levels of support.</p>
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _capitalize from 'lodash/capitalize';
import _toUpper from 'lodash/toUpper'
import _get from 'lodash/get'
import _set from 'lodash/set'
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

const showNumbers = ref(false);

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
        field: `scores.${taskId}.score`,
        header: taskId.toUpperCase(),
        dataType: "text",
        emptyTag: !showNumbers.value,
        tagColor: `scores.${taskId}.color`,
      });
      if(taskId === "pa") {
        for (const subTask of ['del', 'fsm', 'lsm']) {
          tableColumns.push({
            field: `scores.${taskId}.subscores.${subTask}.score`,
            header: `PA - ${subTask.toUpperCase()}`,
            dataType: "text",
            emptyTag: !showNumbers.value,
            tagColor: `scores.${taskId}.subscores.${subTask}.color`,
          })
        }
      }
    }
  }
  return tableColumns;
});

function getColorFromPercentile(percentileScore) {
  let color;
  let support_level;
  if(percentileScore >= 50) {
    support_level = 'at_above'
    color = emptyTagColorMap.above;
  } else if(percentileScore > 25 && percentileScore < 50) {
    support_level = 'some_support'
    color = emptyTagColorMap.some
  } else {
    support_level = "needs_extra"
    color = emptyTagColorMap.below
  }
  return {
    support_level,
    color
  }
}

const tableData = computed(() => {
  return assignmentData.value.map(({ user, assignment }) => {
    const scores = {};
    for (const assessment of (assignment?.assessments || [])) {
      let percentileScore = undefined;
      let del = undefined;
      let fsm = undefined;
      let lsm = undefined;
      if(assessment.taskId === "swr" || assessment.taskId === "swr-es") {
        percentileScore = _get(assessment, 'scores.computed.composite.wjPercentile')
      }
      if(assessment.taskId === "pa") {
        // TODO: this needs to be switched out once Adam completes the script to correct scores
        percentileScore = _get(assessment, 'scores.computed.composite.roarScore')
        del = _get(assessment, 'scores.computed.DEL.roarScore')
        fsm = _get(assessment, 'scores.computed.FSM.roarScore')
        lsm = _get(assessment, 'scores.computed.LSM.roarScore')
      }
      if(assessment.taskId === "sre") {
        percentileScore = _get(assessment, 'scores.computed.composite.tosrecPercentile')
      }
      if(percentileScore !== undefined){
        scores[assessment.taskId] = {
          score: percentileScore,
          ...getColorFromPercentile(percentileScore)
        }
        // Add extra fields to scores object
        if(assessment.taskId === "pa") {
          _set(scores[assessment.taskId], 'subscores.del', {
            score: del,
            ...getColorFromPercentile(del)
          })
          _set(scores[assessment.taskId], 'subscores.fsm', {
            score: fsm,
            ...getColorFromPercentile(fsm)
          })
          _set(scores[assessment.taskId], 'subscores.lsm', {
            score: lsm,
            ...getColorFromPercentile(lsm)
          })
        }
      }
    }
    return {
      user,
      assignment,
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
.report-title {
  font-size: 3.5rem;
  margin-top: 0;
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
.task-overview-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: .5rem;
}
.loading-container {
  text-align: center;
}
.toggle-container {
  display: flex;
  align-items: center;
  justify-content: end;
  width: 100%
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
.legend-description {
  text-align: center;
  margin-top: 1rem;
  margin-bottom: 3rem;
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
.extra-info-title {
  font-size: 2rem;
}
</style>
