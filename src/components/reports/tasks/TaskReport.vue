<template>
  <div class="flex flex-col items-center justify-center mx-2">
    <Accordion v-if="tasksInfoById[taskId]" class="mb-5 w-full">
      <AccordionTab :header="('About ' + tasksInfoById[taskId]?.subheader).toUpperCase()">
        <div style="background-color: {taskInfoById[taskId]?.color}">
          <div style="text-transform: uppercase" class="text-2xl font-bold">{{ tasksInfoById[taskId]?.subheader }}</div>
          <p class="mt-1 text-md font-light">
            {{ tasksInfoById[taskId]?.desc }}
          </p>
          <!-- <div v-for="definition of tasksInfoById[taskId]?.definitions" :key="definition.id" class="my-2">
            <div class="uppercase text-lg font-bold mb-2">{{ definition?.header }}</div>
            <div class="text-md font-light">{{ definition?.desc }}</div>
          </div> -->
        </div>
      </AccordionTab>
    </Accordion>
  </div>
  <!-- <div class="grid grid-cols-2 w-full space-around items-center p-3"> -->
  <div v-if="tasksToDisplayGraphs.includes(taskId)" class="chart-toggle-wrapper">
    <div v-if="orgType === 'district'" class="mb-3">
      <div class="flex uppercase text-xs font-light">view rows by</div>
      <PvSelectButton
        v-model="facetMode"
        class="flex flex-row my-2"
        :options="facetModes"
        option-label="name"
        @change="handleModeChange"
      />
    </div>
    <div class="chart-wrapper">
      <div>
        <DistributionChartSupport
          :initialized="initialized"
          :administration-id="administrationId"
          :org-type="orgType"
          :org-id="orgId"
          :task-id="taskId"
          :runs="runs"
          :facet-mode="facetMode"
        />
      </div>
      <div>
        <DistributionChartFacet
          :initialized="initialized"
          :administration-id="administrationId"
          :org-type="orgType"
          :org-id="orgId"
          :task-id="taskId"
          :runs="runs"
          :facet-mode="facetMode"
        />
      </div>
    </div>
  </div>
  <div class="my-2 mx-4">
    <SubscoreTable
      v-if="taskId === 'letter'"
      task-id="letter"
      :task-name="taskDisplayNames['letter'].name"
      :administration-id="administrationId"
      :org-type="orgType"
      :org-id="orgId"
      :administration-name="administrationInfo.name ?? undefined"
      :org-name="orgInfo.name ?? undefined"
    />
    <SubscoreTable
      v-if="taskId === 'pa'"
      task-id="pa"
      :task-name="taskDisplayNames['pa'].name"
      :administration-id="administrationId"
      :org-type="orgType"
      :org-id="orgId"
      :administration-name="administrationInfo.name ?? undefined"
      :org-name="orgInfo.name ?? undefined"
    />
  </div>
</template>
<script setup>
import DistributionChartFacet from '@/components/reports/DistributionChartFacet.vue';
import DistributionChartSupport from '@/components/reports/DistributionChartSupport.vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import { taskDisplayNames, tasksToDisplayGraphs } from '@/helpers/reports.js';
import SubscoreTable from '@/components/reports/SubscoreTable.vue';
import { ref } from 'vue';

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
    type: Object,
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
    type: Object,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
  runs: {
    type: Array,
    required: true,
  },
});

const facetMode = ref({ name: 'Grade', key: 'grade' });
const facetModes = [
  { name: 'Grade', key: 'grade' },
  { name: 'School', key: 'schoolName' },
];

let tasksInfoById = {
  swr: {
    color: '#E97A49',
    header: 'ROAR-WORD',
    subheader: 'Single Word Recognition',
    desc: "ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's ability to detect real and made-up words, which can then translate to a student's reading levels and need for support. The student's score will range between 100-900 and can be viewed by selecting 'Raw Score' on the table above.",
    definitions: [
      {
        header: 'WHAT IS DECODING',
        desc: 'Decoding refers to the ability to sound out and recognize words by associating individual letters or groups of letters with their corresponding sounds. It involves applying knowledge of letter-sound relationships to read words accurately and fluently.',
      },
      {
        header: 'WHAT IS AUTOMATICITY?',
        desc: 'Automaticity refers to the ability to read words quickly and accurately without having to think about each letter or sound. It allows readers to focus more on understanding what they are reading instead of getting stuck on individual words.',
      },
    ],
  },
  pa: {
    header: 'ROAR-PHONEME',
    color: '#52627E',
    subheader: 'Phonological Awareness',
    desc: "ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks. Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in overall reading proficiency. The student's score will range between 0-57 and can be viewed by selecting 'Raw Score' on the table above.",
    definitions: [
      {
        header: 'What Does Elision Mean?',
        desc: 'Elision refers to the omission or deletion of a sound or syllable within a word. It involves the removal of specific sounds or syllables to create a more streamlined pronunciation. For example, the word "library" may be pronounced as "li-bry" by eliding the second syllable.',
      },
      {
        header: 'WHAT IS PHONOLOGICAL AWARENESS',
        desc: 'Phonological awareness is the ability to recognize and manipulate the sounds of spoken language. It involves an understanding of the individual sounds (phonemes), syllables, and words that make up spoken language. Phonological awareness skills include tasks like segmenting words into sounds, blending sounds to form words, and manipulating sounds within words.',
      },
    ],
  },
  sre: {
    header: 'ROAR-SENTENCE',
    color: '#92974C',
    subheader: 'SENTENCE READING EFFICIENCY',
    desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above.",
    definitions: [
      {
        header: 'WHAT IS FLUENCY?',
        desc: 'Fluency refers to the ability of a student to read text effortlessly, accurately, and with appropriate expression. It involves the skills of decoding words, recognizing sight words, and understanding the meaning of the text. Fluent readers demonstrate a smooth and natural reading pace, which enhances their overall comprehension and enjoyment of reading.',
      },
      {
        header: 'HOW DO THESE SKILLS RELATE TO THE OTHER ROAR ASSESSMENTS?',
        desc: 'ROAR-Sentence Reading Efficiency builds upon fundamental decoding and phonological awareness skills that are present in the ROAR-Word and ROAR-Phonological Awareness assessments. Therefore, if a student needs support with phonological awareness and single word recognition, then it is likely that they will struggle with the reading fluency skills measured by ROAR-Sentence Reading Efficiency.',
      },
    ],
  },
  morph: {
    header: 'ROAR-MORPHOLOGY (WIP)',
    subheader: 'Single Word Recognition',
    desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above.",
  },
  cva: {
    header: 'ROAR-CVA (WIP)',
    subheader: 'Single Word Recognition',
    desc: "ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder for students to understand what they're reading. Students who don't receive support for their basic reading skills may find it challenging to improve their overall reading ability. This assessment is helpful for identifying students who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the table above.",
  },
  letter: {
    color: '#E19834',
    header: 'ROAR-LETTER',
    subheader: 'Single Letter Recognition',
    desc: 'ROAR-Letter assesses a student’s knowledge of letter names and letter sounds. Knowing letter names supports the learning of letter sounds, and knowing letter sounds supports the learning of letter names. Initial knowledge of letter names and letter sounds on entry to kindergarten has been shown to predict success in learning to read. Learning the connection between letters and the sounds they represent is fundamental for learning to decode and spell words. This assessment provides educators with valuable insights to customize instruction and address any gaps in these foundational skills.',
  },
};
</script>
<style>
.chart-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-around;
}

.chart-toggle-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
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
</style>
