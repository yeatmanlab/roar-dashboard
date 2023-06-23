<template>
  {{ code }}
  <AppSpinner />
</template>
<script setup>
import { onMounted } from 'vue'

const props = defineProps({
  code: {required: true, default: ''}
})
onMounted(() => {
  // TODO: Have to get code as a prop
  const clientId = "CLIENT_ID";
  // DANGER, DO NOT SHARE THIS OR COMMIT INTO VERSION CONTROL
  const clientSecret = "SECRET_TOKEN";
  
  const basicAuthHeader = "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  // const baseUri = "https://roar-platform.web.app";
  const baseUri = "https://localhost:5173";
  const redirectUri = `${baseUri}/auth-clever`;

  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": basicAuthHeader,
    },
    body: JSON.stringify(
      {
        code: props.code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }
    )
  };
  console.log(JSON.stringify(requestOptions))
  fetch("https://clever.com/oauth/tokens", requestOptions)
    .then(response => response.json())
    .then(data => {
      const accessToken = data.access_token;
      const idToken = data.id_token;
      console.log(`accessToken: ${accessToken}`);
      console.log(`idToken: ${idToken}`);
    });
  console.log('complete')
})
</script>