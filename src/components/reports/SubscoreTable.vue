<template>
  <div>ROAR-{{ _capitalize(taskId) }} Student Score Information</div>
  <RoarDataTable :columns="columns" :data="tableData" />
</template>
<script setup>
import { computed } from "vue";
import _capitalize from "lodash/capitalize"
import _get from "lodash/get";
import _set from "lodash/set";
import _zip from "lodash/zip";
import _toLower from "lodash/toLower";
import { getGrade } from "@bdelab/roar-utils";
const props = defineProps({
  taskId: { required: true, default: ''},
  taskData: { required: true, default: {} },
  totalRecords: { required: false, default: 10 },
  pageLimit: { required: false, default: 10 },
})

const columns = computed(() => {
  if (props.taskData === undefined) return [];
  const tableColumns = [
    { field: "user.username", header: "Username", dataType: "text", pinned: true },
    { field: "user.name.first", header: "First Name", dataType: "text" },
    { field: "user.name.last", header: "Last Name", dataType: "text" },
    { field: "user.studentData.grade", header: "Grade", dataType: "text" },
  ];
  if(props.taskId === 'letter') {
    tableColumns.push(
      { field: "scores.letter.lowerCaseScore", header: "Lower Case", dataType: "text" },
      { field: "scores.letter.upperCaseScore", header: "Upper Case", dataType: "text" },
      { field: "scores.letter.phonemeScore", header: "Letter Sounds", dataType: "text" },
      { field: "scores.letter.totalScore", header: "Total", dataType: "text" },
      { field: "scores.letter.incorrectLetters", header: "Letters to Work On", dataType: "text" },
      { field: "scores.letter.incorrectPhonemes", header: "Sounds to Work On", dataType: "text"},
    )
  }
  if(props.taskId === 'pa') {
    tableColumns.push(
      { field: "scores.pa.firstSound", header: "First Sound", dataType: "text" },
      { field: "scores.pa.lastSound", header: "Last Sound", dataType: "text" },
      { field: "scores.pa.deletion", header: "deletion", dataType: "text" },
    )
  }
  return tableColumns
})

const tableData = computed(() => {
  if (props.taskData === undefined) return [];
  return props.taskData.map(({ user, assignment }) => {
    const scores = {};
    for (const assessment of (assignment?.assessments || [])) {
      if(assessment.taskId === 'letter') {
        if(_get(assessment, 'scores')){
          console.log('assessment obj', assessment)
          const incorrectLetters = [
            ..._get(assessment, 'scores.computed.UppercaseNames.upperIncorrect').split(','),
            ..._get(assessment, 'scores.computed.LowercaseNames.lowerIncorrect').split(',')
          ].sort((a, b) => _toLower(a) - _toLower(b)).filter(Boolean).join(', ');

          const incorrectPhonemes = _get(assessment, 'scores.computed.Phonemes.phonemeIncorrect').split(',').join(', ')

          _set(scores, 'letter', {
            upperCaseScore: _get(assessment, 'scores.computed.LowercaseNames.subScore'),
            lowerCaseScore: _get(assessment, 'scores.computed.UppercaseNames.subScore'),
            phonemeScore: _get(assessment, 'scores.computed.Phonemes.subScore'),
            totalScore: _get(assessment, 'scores.computed.composite'),
            incorrectLetters: incorrectLetters,
            incorrectPhonemes: incorrectPhonemes,
          })
        }
      }
      if(assessment.taskId === 'pa') {
        if(_get(assessment, 'scores')) {
          console.log('assessment obj', assessment)
          _set(scores, 'pa', {
            firstSound: _get(assessment, 'scores.computed.FSM.roarScore'),
            lastSound: _get(assessment, 'scores.computed.LSM.roarScore'),
            deletion: _get(assessment, 'scores.computed.DEL.roarScore'),
          })
        }
      }
    }
    return {
      user,
      assignment,
      scores
    }
  })
})
</script>