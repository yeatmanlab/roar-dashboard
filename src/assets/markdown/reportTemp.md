#### Show Data Table

- {{ swrStats.numStudents }} students in grades {{ swrStats.gradeMin }} to {{ swrStats.gradeMax }} completed the Single Word Recognition task.

<div id='viz-distribution-by-grade'></div>
<div id='viz-normed-percentile-distribution'></div>
<div id='viz-stacked-support-by-grade'></div>
<div id='viz-first-grade-percentile-distribution'></div>
<div id='viz-automaticity-distributions-first-grade'></div>

<RoarDataTable :data="scores" :columns="columns" />

Below DataTable


<script setup>
const props = defineProps({
    scores: {type: Object, default: {}},
    swrStats: {type: Object, default: {}},
    columns: {type: Array, default: []}
});
</script>