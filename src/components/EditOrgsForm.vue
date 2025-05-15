<template>
  <div class="flex flex-column gap-3">
    <div class="form-container">
      <div class="form-field w-full">
        <label :class="{ 'font-light uppercase text-sm': !editMode }">Name</label>
        <div v-if="!editMode" :class="{ 'text-xl': !editMode }">{{ serverOrgData.name ?? 'None' }}</div>
        <PvInputText v-else v-model="localOrgData.name" />
      </div>
    </div>
    <div class="form-field">
      <label :class="{ 'font-light uppercase text-sm': !editMode }">Tags</label>
      <PvChips v-model="localOrgData.tags" />
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { fetchDocById } from '@/helpers/query/utils';
import { useQuery } from '@tanstack/vue-query';
import PvChips from 'primevue/chips';
import PvInputText from 'primevue/inputtext';
import _isEmpty from 'lodash/isEmpty';


const props = defineProps({
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  editMode: { type: Boolean, default: true },
});

// +------------+
// | Initialize |
// +------------+
const initialized = ref(false);
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const emit = defineEmits(['modalClosed', 'update:orgData']);

// +----------------------------+
// | Query for existing orgData |
// +----------------------------+
const { data: serverOrgData } = useQuery({
  queryKey: ['org', props.orgType, props.orgId],
  queryFn: () => fetchDocById(props.orgType, props.orgId),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// +-------------+
// | Local State |
// +-------------+
const localOrgData = ref({
  name: null,
  tags: [],
});

const setupOrgData = (orgData) => {
  let org = {
    name: orgData?.name ?? '',
    tags: orgData?.tags ?? [],
  };
  localOrgData.value = org;
};

watch(
  () => serverOrgData,
  (orgData) => {
    if (!_isEmpty(orgData)) {
      setupOrgData(orgData.value);
    }
  },
  { deep: true, immediate: false },
);

// +--------------------+
// | Initialize firekit |
// +--------------------+
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit?.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value?.restConfig) init();
  if (!_isEmpty(serverOrgData.value)) setupOrgData(serverOrgData.value);
});

// +---------------------+
// | Handle update event |
// +---------------------+
watch(
  () => localOrgData,
  (orgData) => {
    emit('update:orgData', orgData.value);
  },
  { deep: true, immediate: false },
);
</script>
<style>
.form-container {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  width: 100%;
}
.form-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}
.form-field {
  display: flex;
  flex-direction: column;
}
/* Styles for PvChips */
.p-chips > ul {
  width: 100%;
}

.p-chips-token {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  background: var(--primary-color);
  padding: 0.25rem;
  border-radius: 0.35rem;
  color: white;
  margin: 0.05rem;
}

.p-chips-token-icon,
g {
  margin-left: 0.5rem;
  color: white;
}

</style>
