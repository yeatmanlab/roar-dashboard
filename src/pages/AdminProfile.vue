<template>
  <div class="flex flex-row" style="max-height: 100vh">
    <!-- Sidebar -->
    <!-- <div class="sidebar-container">
      <a href="#your-information"><div class="sidebar-button">Your Information</div></a>
      <a href="#change-password"><div class="sidebar-button">Change Password</div></a>
      <a href="#link-accounts"><div class="sidebar-button">Link Accounts</div></a>
    </div> -->
    <!-- Main Page Content-->
    <div class="page-container">
      <div class="form-card">
        <section id="your-information" class="form-section">
          <h2>Your Information</h2>
          <EditUsersForm :user-data="userData" v-model="userDataModel" @update:userData="localUserData = $event" />
          <div class="flex">
            <PvButton
              @click="submitUserData"
              label="Update"
              class="border-none border-round bg-primary text-white p-2 hover:surface-400 ml-auto"
            />
          </div>
        </section>
        <section id="change-password" class="form-section">
          <h2>Change Your Password</h2>
          <div class="flex flex-column">
            <label>New password</label>
            <PvInputText v-model="v$.password.$model" :class="{ 'p-invalid': v$.password.$invalid && submitted }" />
            <small v-if="v$.password.$invalid && submitted" class="p-error"
              >Password must be at least 6 characters long.</small
            >
          </div>
          <div class="flex flex-column mt-3">
            <label>Confirm password</label>
            <PvInputText
              v-model="v$.confirmPassword.$model"
              :class="{ 'p-invalid': v$.confirmPassword.$invalid && submitted }"
            />
            <small v-if="v$.confirmPassword.$invalid && submitted" class="p-error">Passwords do not match.</small>
          </div>
          <div class="flex mt-3">
            <PvButton
              @click="updatePassword"
              label="Update Password"
              class="border-none border-round bg-primary text-white p-2 hover:surface-400 ml-auto"
            />
          </div>
        </section>
        <!-- <div v-for="(item, index) of arrayItems" class="py-5">Line here</div> -->
        <section id="link-accounts">
          <h2>Link Accounts</h2>
          <span>Make logging in easy by linking your accounts.</span>
          <div class="button-container">
            <PvButton>Log in with Clever</PvButton>
            <PvButton>Log in with Google</PvButton>
            <PvButton>Log in with ClassLink</PvButton>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useVuelidate } from '@vuelidate/core';
import { useAuthStore } from '@/store/auth';
import { useToast } from 'primevue/usetoast';
import { storeToRefs } from 'pinia';
import { required, sameAs, minLength } from '@vuelidate/validators';
import { useQuery } from '@tanstack/vue-query';
import EditUsersForm from '../components/EditUsersForm.vue';
import { fetchDocById } from '../helpers/query/utils';

// +----------------+
// | Initialization |
// +----------------+
const localUserData = ref({});

// +-----------+
// | Vuelidate |
// +-----------+
const passwordRef = computed(() => state.password);
const rules = {
  password: {
    required,
    minLength: minLength(6),
  },
  confirmPassword: {
    required,
    sameAsPassword: sameAs(passwordRef),
  },
};
const state = reactive({
  password: '',
  confirmPassword: '',
});
const v$ = useVuelidate(rules, state);
const submittingPassword = ref(false);
const submitted = ref(false);

// +----------------------+
// | Submitting functions |
// +----------------------+
const authStore = useAuthStore();
const toast = useToast();
const { roarfirekit, uid } = storeToRefs(authStore);

async function updatePassword() {
  submitted.value = true;
  if (!v$.value.$invalid) {
    await roarfirekit.value
      .updateUserData(uid, { password: state.password })
      .then(() => {
        console.log('password updated!');
        toast.add({ severity: 'success', summary: 'Updated', detail: 'Password Updated!', life: 3000 });
      })
      .catch((error) => {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Unable to update password' });
      });
  }
}

async function submitUserData() {
  console.log('Submitting user data', localUserData.value);
}

// +-------------------+
// | Utility functions |
// +-------------------+
const arrayItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const userDataModel = ref({});

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
  if (state.roarfirekit.updateUserData) init();
});

onMounted(() => {
  if (roarfirekit.value.updateUserData) init();
});

// +---------+
// | Queries |
// +---------+
const { data: userData } = useQuery({
  queryKey: ['userData', uid],
  queryFn: () => fetchDocById('users', uid.value),
  keepPrevousData: true,
  enabled: initialized,
  staleTime: 1000 * 60 * 5, // 5 minutes
});
</script>
<style lang="scss" scoped>
.sidebar-container {
  background-color: var(--surface-b);
  flex-basis: 25%;
  height: calc(100vh - 119px);
  border-right: 2px solid var(--surface-d);
}
.sidebar-button {
  width: 100%;
  background-color: var(--surface-d);
  padding: 1rem;
}
.page-container {
  background-color: red;
  flex-basis: 75%;
  flex-grow: 1;
  max-height: calc(100vh - 119px);
  overflow: scroll;
  padding: 1rem;
  scroll-behavior: smooth;
  div {
    width: 66vw;
    margin-right: auto;
    margin-left: auto;
  }
}
.form-card {
  padding: 1rem;
  background-color: white;
}
.form-section {
  background-color: white;
}
#link-accounts:target {
  animation: highlight-section 3s 1;
  -webkit-animation: highlight-section 3s 1;
}
#change-password:target {
  animation: highlight-section 3s 1;
  -webkit-animation: highlight-section 3s 1;
}
#your-information:target {
  animation: highlight-section 3s 1;
  -webkit-animation: highlight-section 3s 1;
}

// div:hover {
//   animation: myfirst 4s 1;
//   -webkit-animation: myfirst 4s 1; /* Safari and Chrome */
// }

@keyframes highlight-section {
  0% {
    background: white;
  }
  25% {
    background: #ffa;
  }
  75% {
    background: #ffa;
  }
  100% {
    background: white;
  }
}

@-webkit-keyframes highlight-section /* Safari and Chrome */ {
  0% {
    background: white;
  }
  25% {
    background: #ffa;
  }
  75% {
    background: #ffa;
  }
  100% {
    background: white;
  }
}
</style>
