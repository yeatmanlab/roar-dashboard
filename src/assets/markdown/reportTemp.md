#### Show Data Table

<RoarDataTable :data="scores" :columns="columns" />

Below DataTable

<script setup>
const props = defineProps({
    scores: {type: Object, default: {}},
    columns: {type: Array, default: []}
});
</script>