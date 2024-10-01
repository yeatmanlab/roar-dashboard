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
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
        @click="unlinkAccount('google')"
      >
        Unlink
      </button>
      <button
        v-else
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
        @click="linkAccount('google')"
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
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
        @click="unlinkAccount(AUTH_SSO_PROVIDERS.CLEVER)"
      >
        Unlink
      </button>
      <button
        v-else
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
        @click="linkAccount(AUTH_SSO_PROVIDERS.CLEVER)"
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
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
        @click="unlinkAccount(AUTH_SSO_PROVIDERS.CLASSLINK)"
      >
        Unlink
      </button>
      <button
        v-else
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400 mr-2"
        @click="linkAccount(AUTH_SSO_PROVIDERS.CLASSLINK)"
      >
        Link
      </button>
    </div>
  </div>
  <div>
    <h2 style="margin-top: 3.5rem">Delete Password</h2>
    <span
      >You have the option to remove your password if you want to exclusively use an SSO option listed above. You must
      have <span class="font-bold"> at least one</span> other login method linked to delete your password.</span
    >
    <div class="flex justify-content-end">
      <button
        :disabled="!canDeletePassword"
        class="border-none border-round bg-primary text-white p-2 my-2 hover:surface-400"
        @click="deletePassword"
      >
        Delete Password
      </button>
    </div>
  </div>
  <PvConfirmDialog />
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { AUTH_SSO_PROVIDERS } from '@/constants/auth';

// +----------------+
// | Initialization |
// +----------------+
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const toast = useToast();
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

// +-----------------------+
// | Linking and Unlinking |
// +-----------------------+
const linkAccount = async (providerId) => {
  console.log(`Linking account with ${providerId}`);
  await roarfirekit.value
    .linkAuthProviderWithPopup(providerId)
    .then(() => {
      return roarfirekit.value.forceIdTokenRefresh();
    })
    .catch((error) => {
      const errorCode = error.code;
      if (errorCode === 'auth/provider-already-linked') {
        // This user already has credentials for this provider
        toast.add({
          severity: 'error',
          summary: 'Account already linked',
          detail: 'This account is already associated with that provider.',
          life: 3000,
        });
      } else if (errorCode === 'auth/auth/credential-already-in-use') {
        // This credential is already linked with another account
        toast.add({
          severity: 'error',
          summary: 'Email already in use',
          detail: 'The login you provided is already associated with an existing account.',
          life: 3000,
        });
      } else if (errorCode === 18) {
        // Error code for known cross-origin popup issue. Ignore.
        console.log('Cross-origin popup error ignored.');
      } else {
        // Oops! Error occured.
        toast.add({
          severity: 'error',
          summary: 'Error occurred',
          detail: 'An unexpected error occurred while linking this account.',
          life: 3000,
        });
      }
      return roarfirekit.value.forceIdTokenRefresh();
    });
};
const unlinkAccount = async (providerId) => {
  console.log(`Unlinking account with ${providerId}`);
  roarfirekit.value.unlinkAuthProvider(providerId);
};

// +-----------------+
// | Delete Password |
// +-----------------+
const confirm = useConfirm();
const canDeletePassword = computed(() => {
  return providerIds.value.includes('password') && providerIds.value.length > 1;
});
const deletePassword = async () => {
  confirm.require({
    message: 'Once deleted, you will need to use an SSO option to access your account!',
    header: 'Delete Password',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    accept: async () => {
      await unlinkAccount('password')
        .then(() => {
          toast.add({
            severity: 'success',
            summary: 'Password Deleted',
            detail: 'Password authentication has been removed from your account.',
            life: 3000,
          });
        })
        .catch(() => {
          toast.add({
            severity: 'error',
            summary: 'Error occurred',
            detail: 'An unexpected error occurred while deleting your password.',
            life: 3000,
          });
        });
    },
  });
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
  border-radius: 20px;
  padding-left: 10px;
  gap: 5px;
  width: 100%;
  height: 100%;
}
.unlinked-chip {
  background-color: var(--red-400);
  color: var(--red-800);
  border: solid 1px var(--red-800);
  border-radius: 20px;
  padding-left: 10px;
  gap: 5px;
  width: 100%;
  height: 100%;
}
.chip-container {
  width: 100px;
  height: 24px;
  margin-top: auto;
  margin-bottom: auto;
}
</style>
