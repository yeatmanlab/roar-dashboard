#### Show Data Table


<div> <RoarDataTable data="" columns="" /> </div>
<script setup>
    import {useScoreStore} from "@/store/scores";
    import {ref} from "vue";
    const scoreStore = useScoreStore();    

    const tableColumns = ref([
        {
            "field": "scores.runInfoOrig.name.first", 
            "header": "First Name", 
            "allowMultipleFilters": true,
            "dataType": "text",
        }
    ]);

</script>