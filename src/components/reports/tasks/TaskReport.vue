<template>
    <div className="mb-5">
        <Accordion>
            <template #collapseicon>
                <i class="pi pi-info-circle mr-4" />
            </template>
            <template #expandicon>
                <i class="pi pi-info-circle mr-4" />
            </template>
            <AccordionTab :header="tasksInfoById[taskId].header">
                <div style="text-transform: uppercase" class="text-2xl">{{ tasksInfoById[taskId]?.subheader }}</div>
                <p class="mt-2">
                    {{ tasksInfoById[taskId]?.desc }} 
                </p>
            </AccordionTab>
        </Accordion>
    </div>
    <div class="flex flex-row flex-wrap">
        <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
            :org-id="orgId" :task-id="taskId" graph-type="distByGrade" />
        <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
            :org-id="orgId" :task-id="taskId" graph-type="distBySupport" />
    </div>
    <div class="my-2 mx-4">
        <SubscoreTable
v-if="taskId === 'letter'" task-id="letter" :task-name="taskDisplayNames['letter'].name"
            :administration-id="administrationId" :org-type="orgType" :org-id="orgId"
            :administration-name="administrationInfo.name ?? undefined" :org-name="orgInfo.name ?? undefined" />
        <SubscoreTable
v-if="taskId === 'pa'" task-id="pa" :task-name="taskDisplayNames['pa'].name"
            :administration-id="administrationId" :org-type="orgType" :org-id="orgId"
            :administration-name="administrationInfo.name ?? undefined" :org-name="orgInfo.name ?? undefined" />

    </div>
    <!-- <div class="task-card">
    </div> -->
</template>
<script setup>
import DistributionChart from '../DistributionChart.vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import { taskDisplayNames } from '@/helpers/reports.js';
import SubscoreTable from '../SubscoreTable.vue';

// eslint-disable-next-line no-unused-vars
const props = defineProps({
    initialized: {
        type: Boolean,
        required: true,
    },
    administrationId: {
        type: String,
        required: true,
    },
    administrationInfo: {
        type: String,
        required: true,
    },
    orgType: {
        type: String,
        required: true,
    },
    orgId: {
        type: String,
        required: true,
    },
    orgInfo: {
        type: String,
        required: true,
    },
    taskId: {
        type: String,
        required: true,
    },
});

let tasksInfoById = {
    "swr": {
        header: "ROAR-WORD",
        subheader: "Single Word Recognition",
        desc: "ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. The student's score will rangekkk between 100-900 and can be viewed by selecting 'Raw Score' on the table above."
    },
    "pa": {
        header: "ROAR-PHONEME",
        subheader: "Phonological Awareness",
        desc: "ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in overall reading proficiency. The student's score will range between 0-57 and can be viewed by selecting 'Raw Score' on the table above."
    },
    "sre": {
        header: "ROAR-SENTENCE",
        subheader: "SENTENCE READING EFFICIENCY",
        desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above."
    },
    "morph": {
        header: "ROAR-MORPHOLOGY (WIP)",
        subheader: "Single Word Recognition",
        desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above."
    },
    "cva": {
        header: "ROAR-CVA (WIP)",
        subheader: "Single Word Recognition",
        desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above."
    },
    "letter": {
        header: "ROAR-LETTER",
        subheader: "Single Letter Recognition",
        desc: "ROAR-Letter assesses a student’s knowledge of letter names and letter sounds. Knowing letter names supports the learning of letter sounds, and knowing letter sounds supports the learning of letter names. Initial knowledge of letter names and letter sounds on entry to kindergarten has been shown to predict success in learning to read. Learning the connection between letters and the sounds they represent is fundamental for learning to decode and spell words. This assessment provides educators with valuable insights to customize instruction and address any gaps in these foundational skills."
    },
}
</script>
<style>
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
</style>
  