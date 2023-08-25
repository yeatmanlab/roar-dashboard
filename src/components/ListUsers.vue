<template>
  List users Page!
</template>
<script setup>
import { defineProps } from "vue";

const props = defineProps({
  orgs: { required: true, default: {} }
})

const users = ref([
  {
    username: 'listedUser1',
    firstname: 'First1',
    lastname: 'Last1',
    district: 'Elijah Test District',
    school: 'Elijah Test School',
    classes: ['class1', 'class2'],
    studentData: {
      dob: new Date(),
      grade: '5',
      gender: 'male'
    }
  }
]);
</script>