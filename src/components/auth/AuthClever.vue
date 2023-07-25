<template>
  {{ code }}
  <AppSpinner />
</template>
<script setup>
import { onMounted, watch } from 'vue'
import { useAuthStore } from '@/store/auth'
import { storeToRefs } from 'pinia';
import _get from "lodash/get"
import { httpsCallable } from 'firebase/functions';
// import { useRouter } from 'vue-router'

const props = defineProps({
  code: {required: true, default: ''}
})
const baseUri = _get(new URL(window.location), 'origin')

const authStore = useAuthStore();
const { isFirekitInit } = storeToRefs(authStore);

async function callCloud(){
  console.log('inside call cloud')
  const currentURL = new URL(window.location)
  const redirectUri = `${currentURL.origin}${currentURL.pathname}`
  console.log('currentUrl', currentURL)
  console.log('redirectURI', redirectUri)

  const authStore_firekit = authStore.roarfirekit
  console.log('authstore firkeit', authStore.roarfirekit.admin)
  const syncAdminCleverData = httpsCallable(authStore.roarfirekit.admin.functions, 'synccleverdata');
  const syncAppCleverData = httpsCallable(authStore.roarfirekit.app.functions, 'synccleverdata');
  const adminResult = await syncAdminCleverData({
    adminUid: "JkL67Wd9mQNDIZJloTuFNRgem7r2",
    roarUid: "JkL67Wd9mQNDIZJloTuFNRgem7r2",
    assessmentUid: "IrPXotYPcTVMiuy3i0W7o7fOrQp2",
    accessCode: props.code,
    redirectUri,
  });
  const appResult = await syncAppCleverData({
    roarUid: "JkL67Wd9mQNDIZJloTuFNRgem7r2",
    adminUid: "JkL67Wd9mQNDIZJloTuFNRgem7r2",
    assessmentUid: "IrPXotYPcTVMiuy3i0W7o7fOrQp2",
    accessCode: props.code,
    redirectUri,
  });
}

watch(isFirekitInit, async (newValue, oldValue) => {
  console.log('old, new', oldValue, newValue);
  console.log('calling cloud functions')
  await callCloud()
})
// == //
// await authStore.roarfirekit.signInFromRedirectResult();
// console.log('afterwords')
// == //
// const clientId = "CLIENT_ID";
// // DANGER, DO NOT SHARE THIS OR COMMIT INTO VERSION CONTROL
// const clientSecret = "SECRET_TOKEN";

// const basicAuthHeader = "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
// // const baseUri = "https://roar-platform.web.app";
// const baseUri = "https://localhost:5173";
// const redirectUri = `${baseUri}/auth-clever`;

// const requestOptions = {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//     "Authorization": basicAuthHeader,
//   },
//   body: JSON.stringify(
//     {
//       code: props.code,
//       grant_type: "authorization_code",
//       redirect_uri: redirectUri,
//     }
//   )
// };
// console.log(JSON.stringify(requestOptions))
// fetch("https://clever.com/oauth/tokens", requestOptions)
//   .then(response => response.json())
//   .then(data => {
//     const accessToken = data.access_token;
//     const idToken = data.id_token;
//     console.log(`accessToken: ${accessToken}`);
//     console.log(`idToken: ${idToken}`);
//   });
// console.log('complete')
</script>