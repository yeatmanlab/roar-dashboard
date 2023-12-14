<!--roar/scores/administrationId/user/userId-->
<!--get userId from props, -->

<template>Student Score report</template>

<script setup>
import { fetchDocById } from '../helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../store/auth';
// import {getSidebarActions} from "../router/sidebarActions";

const authStore = useAuthStore();

const { roarfirekit } = storeToRefs(authStore);

// const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin, true));

// const props = defineProps({
//   administrationId: {
//     type: String,
//     required: true,
//   },
//   userId: {
//     type: String,
//     required: true,
//   },
// });

const refreshing = ref(false);
const initialized = ref(false);

// const {data: studentInfo } = useQuery({
//   queryKey: ['users', props.userId],
//   queryFn: () => fetchDocsById('users', props.userId),
//   keepPreviousData: true,
//   staleTime: 5 * 60 * 1000,
// })

const { data: studentInfo } = useQuery({
  queryKey: ['users', '00gVdeMNTrNUv7f0ph6PNQRwz243'],
  queryFn: () => fetchDocById('users', '00gVdeMNTrNUv7f0ph6PNQRwz243'),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
});

if (studentInfo && initialized.value) {
  console.log('info', studentInfo.value);
}

const { data: studentAssignments } = useQuery({
  queryKey: ['users', '00gVdeMNTrNUv7f0ph6PNQRwz243'],
  queryFn: () => fetchDocById('users', '00gVdeMNTrNUv7f0ph6PNQRwz243', ['runs'], 'app'),
  enabled: initialized,
  keepPreviousData: true,
  staleTime: 5 * 60 * 1000,
});

if (studentAssignments && initialized.value) {
  console.log('runs', studentAssignments.value);
}

let unsubscribe;
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();
  console.log('info', studentInfo.value);
  console.log('runs', studentAssignments.value);

  refreshing.value = false;
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) refresh();
});
</script>
