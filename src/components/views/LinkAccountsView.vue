<template>
  <h2>Link Accounts</h2>
  <span>Make logging in easy by linking your accounts.</span>
  <div class="table-container">
    <!-- Google -->
    <div class="flex flex-row justify-content-between w-full" style="background-color: var(--surface-d)">
      <div class="flex flex-row w-full h-3rem p-2 gap-2">
        <img src="../../assets/provider-google-logo.svg" alt="The Google Logo" class="mr-2" />
        <span style="line-height: 30px" class="text-lg">Google</span>
        <div class="chip-container">
          <PvChip v-if="providerIds.includes('google.com')" icon="pi pi-check" label="Linked" class="linked-chip" />
          <PvChip v-else label="Linked" icon="pi pi-times" class="unlinked-chip" />
        </div>
      </div>
      <button
        v-if="providerIds.includes('google.com')"
        @click="unlinkAccount('google')"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
      >
        Unlink
      </button>
      <button
        v-else
        @click="linkAccount('google')"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
      >
        Link
      </button>
    </div>
    <!-- Clever -->
    <div class="flex flex-row justify-content-between w-full">
      <div class="flex flex-row h-3rem p-2 gap-2">
        <img src="../../assets/provider-clever-logo.svg" alt="The Clever Logo" class="mr-2" />
        <span style="line-height: 30px" class="text-lg">Clever</span>
        <div class="chip-container">
          <PvChip v-if="providerIds.includes('oidc.clever')" icon="pi pi-check" label="Linked" class="linked-chip" />
          <PvChip v-else label="Linked" icon="pi pi-times" class="unlinked-chip" />
        </div>
      </div>
      <button
        v-if="providerIds.includes('oidc.clever')"
        @click="unlinkAccount('clever')"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
      >
        Unlink
      </button>
      <button
        v-else
        @click="linkAccount('clever')"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
      >
        Link
      </button>
    </div>
    <!-- ClassLink -->
    <div class="flex flex-row justify-content-between w-full" style="background-color: var(--surface-d)">
      <div class="flex flex-row h-3rem p-2 gap-2">
        <img src="../../assets/provider-classlink-logo.png" alt="The ClassLink Logo" class="mr-2" />
        <span style="line-height: 30px" class="text-lg">ClassLink</span>
        <div class="chip-container">
          <PvChip v-if="providerIds.includes('oidc.classlink')" icon="pi pi-check" label="Linked" class="linked-chip" />
          <PvChip v-else label="Linked" icon="pi pi-times" class="unlinked-chip" />
        </div>
      </div>
      <button
        v-if="providerIds.includes('oidc.classlink')"
        @click="unlinkAccount('classlink')"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
      >
        Unlink
      </button>
      <button
        v-else
        @click="linkAccount('classlink')"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
      >
        Link
      </button>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const providerIds = computed(() => {
  const providerData = roarfirekit.value?.admin?.user?.providerData;
  return providerData.map((provider) => {
    return provider.providerId;
  });
});

// +-------------------------+
// | Firekit Inititalization |
// +-------------------------+
const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(() => {
  if (roarfirekit.value.restConfig) init();
});

// +---
// |
// +---
const linkAccount = async (providerId) => {
  console.log(`Linking account with ${providerId}`);
};
const unlinkAccount = async (providerId) => {
  console.log(`Unlinking account with ${providerId}`);
};
</script>
<style scoped>
.table-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
  background-color: var(--surface-b);
  border: solid 1px var(--surface-d);
  border-radius: var(--border-radius);
}
.linked-chip {
  background-color: var(--green-400);
  color: var(--green-800);
  border: solid 1px var(--green-800);
  width: 100%;
  height: 100%;
}
.unlinked-chip {
  background-color: var(--red-400);
  color: var(--red-800);
  border: solid 1px var(--red-800);
  width: 100%;
  height: 100%;
}
.chip-container {
  width: 108px;
  height: 24px;
  margin-top: auto;
  margin-bottom: auto;
}
</style>
