<script setup>
// Thin routing wrapper for the SignTos flow. All orchestration logic lives in
// the container (containers/SignTos/SignTos.vue) per the container/presentational
// pattern documented in `.ai/rules/frontend-layer-architecture.md`.
//
// Sign-out reachability: the global `Navigation` component renders even on
// the SignTos page (it's not in `navbarBlacklist`), so the navbar sign-out
// button remains the user's escape hatch. The router's TOS guard explicitly
// allows transitions to `SignIn`, and `useSignOutMutation` redirects there
// after clearing auth state, so sign-out succeeds without being intercepted
// by the unsigned-TOS guard.
import SignTosContainer from '@/containers/SignTos/SignTos.vue';
</script>

<template>
  <SignTosContainer />
</template>
