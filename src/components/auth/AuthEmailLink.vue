<template>
  <AppSpinner v-if="localStorageEmail" />
  <div v-else class="field col">
    <PvFloatLabel>
      <PvInputText id="email" v-model="formEmail" />
      <label for="email">Email</label>
    </PvFloatLabel>
    <div class="col-12 mb-3">
      <PvButton label="Finish signing in" @click="loginFromEmailLink(formEmail)" />
    </div>
  </div>
  <transition-group name="p-message" tag="div">
    <PvMessage v-for="msg of messages" :key="msg.id" :severity="msg.severity">{{ msg.content }}</PvMessage>
  </transition-group>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Router } from 'vue-router';
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import PvInputText from 'primevue/inputtext';
import PvMessage from 'primevue/message';
import PvFloatLabel from 'primevue/floatlabel';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import AppSpinner from '@/components/AppSpinner.vue';

// --- Interfaces & Types ---
interface Message {
  id: number;
  severity: 'warn' | 'error' | 'info' | 'success'; // PrimeVue severities
  content: string;
}

// Define more specific types if available from the store
interface UserData { [key: string]: any; }
interface UserClaims { [key: string]: any; }
interface AuthStoreState { 
  roarfirekit: any; // Use a more specific type if available
  isSignInWithEmailLink?: boolean;
  signInWithEmailLink?: (...args: any[]) => Promise<any>; // Define args/return if known
  userData: UserData | null;
  userClaims: UserClaims | null;
}

// --- Router & Store ---
const router: Router = useRouter();
const authStore = useAuthStore();
// Use 'any' for potentially untyped store refs/state if needed
const { roarfirekit, roarUid, uid } = storeToRefs(authStore) as { 
    roarfirekit: Ref<any>, 
    roarUid: Ref<string | null>, 
    uid: Ref<string | null> 
};

// --- Refs ---
const success: Ref<boolean> = ref(false);
const formEmail: Ref<string | undefined> = ref();
const localStorageEmail: Ref<string | null> = ref(null);
const messages: Ref<Message[]> = ref([]);

// --- Functions ---
function addMessages(errorCode: string): void {
  let messageContent = '';
  if (errorCode === 'auth/invalid-action-code') {
    messageContent = 
      'There was an issue with the sign-in link that you clicked on. This can happen when you attempt reuse a sign-in link from a previous email. We are rerouting you to the sign-in page to request another link.';
  } else if (errorCode === 'timeout') { // Assuming 'timeout' is a custom code?
    messageContent = 
      'There was an issue with the email sign-in link. We apologize for the inconvenience and are rerouting you to the sign-in page to request another link.';
  } else {
      messageContent = `An unexpected error occurred: ${errorCode}`;
  }
  messages.value = [
    {
      severity: 'warn',
      content: messageContent,
      id: Date.now(), // Use timestamp for unique ID
    },
  ];
}

async function loginFromEmailLink(email: string | undefined): Promise<void> {
  if (!email) {
      addMessages('email-missing'); // Or handle appropriately
      return;
  }
  if (storeSubscription) storeSubscription(); // Unsubscribe before logging in
  const emailLink = window.location.href;

  try {
    // Assume signInWithEmailLink exists and is typed in store or use 'as any'
    await (authStore as any).signInWithEmailLink({ email, emailLink });
    // Success is handled by the subscription below
  } catch (error: any) {
    console.error('Error signing in with email link:', error);
    if (error.code === 'auth/invalid-action-code') {
      addMessages(error.code);
      setTimeout(() => {
        router.replace({ name: 'SignIn' });
      }, 5000);
    } else {
      addMessages(error.code || 'unknown-error');
      // Potentially route back to sign-in immediately for other errors
      // setTimeout(() => { router.replace({ name: 'SignIn' }); }, 5000);
    }
  } 
}

// --- Store Subscription ---
// Use type assertion for potentially untyped store state
const storeSubscription = (authStore as any).$subscribe(async (mutation: any, state: AuthStoreState) => {
  // Check based on uid which should be set after successful login
  if (uid.value && !success.value) { // Check !success to prevent multiple runs
    try {
        // Assume fetchDocById returns Promise<UserData | null>
        const userData = await (fetchDocById as any)('users', uid.value);
        const userClaims = await (fetchDocById as any)('userClaims', uid.value);
        authStore.userData = userData;
        authStore.userClaims = userClaims;
        success.value = true;
        window.localStorage.removeItem('emailForSignIn'); // Clear email after successful use
        router.push({ name: 'Home' });
    } catch (error) {
        console.error("Error fetching user data after login:", error);
        // Handle error, maybe show a message
    }
  } 
  
  // Logic for handling the link *before* email is known (initial page load)
  if (state.roarfirekit?.isSignInWithEmailLink && !formEmail.value && !localStorageEmail.value) { 
      if (!state.roarfirekit.isSignInWithEmailLink(window.location.href)) {
          // Invalid link, redirect home or signin
          router.replace({ name: 'SignIn' }); 
      }
      // If it's a valid link but no email in storage, we need the user to input it.
      // The component template already handles showing the input form.
  }
});

// --- Lifecycle Hooks ---
onMounted(async () => {
  localStorageEmail.value = window.localStorage.getItem('emailForSignIn');
  if (localStorageEmail.value) {
    // Automatically attempt login if email is found in local storage
    await loginFromEmailLink(localStorageEmail.value);
  } else if (roarfirekit.value?.isSignInWithEmailLink) {
       // Check if it's a sign-in link but email is missing
       if (!roarfirekit.value.isSignInWithEmailLink(window.location.href)) {
            // Invalid link, redirect
            router.replace({ name: 'SignIn' }); 
       }
       // Otherwise, wait for user to enter email in the form
  }
});

onUnmounted(() => {
  if (storeSubscription) {
    storeSubscription(); // Clean up subscription
  }
});
</script>
