<template>
  <div class="self-registration-success">
    <span class="self-registration-success-icon" aria-hidden="true">
      <i class="pi pi-check-circle" />
    </span>

    <div class="self-registration-success-copy">
      <h1 id="self-registration-success-heading" ref="heading" tabindex="-1">
        {{ t('pageRegister.accountCreated') }}
      </h1>
      <p>{{ t('pageRegister.accountCreatedMessage', { firstName: displayName }) }}</p>
    </div>

    <RouterLink class="self-registration-success-action" :to="APP_ROUTES.SIGN_IN">
      <span>{{ t('pageRegister.continueToSignIn') }}</span>
      <i class="pi pi-arrow-right" aria-hidden="true" />
    </RouterLink>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { APP_ROUTES } from '@/constants/routes';
import { i18n } from '@/translations/i18n';

const props = defineProps({
  firstName: { type: String, required: true },
});

const { t } = i18n.global;
const heading = ref(null);
const displayName = computed(() => props.firstName.trim());

onMounted(() => heading.value?.focus());
</script>

<style scoped>
.self-registration-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 0 0.25rem;
  text-align: center;
}

.self-registration-success-icon {
  display: inline-flex;
  width: 3.5rem;
  height: 3.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary-color) 10%, white);
  color: var(--primary-color);
}

.self-registration-success-icon i {
  font-size: 2rem;
}

.self-registration-success-copy {
  display: grid;
  gap: 0.75rem;
}

.self-registration-success-copy h1,
.self-registration-success-copy p {
  margin: 0;
}

.self-registration-success-copy h1 {
  color: var(--text-color);
  font-size: 1.75rem;
  font-weight: 400;
  line-height: 1.25;
}

.self-registration-success-copy h1:focus {
  outline: none;
}

.self-registration-success-copy p {
  max-width: 23rem;
  color: var(--text-color-secondary);
  font-size: 1rem;
  line-height: 1.65;
}

.self-registration-success-action {
  display: inline-flex;
  width: 100%;
  max-width: 20rem;
  height: 3rem;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding: 0 1.5rem;
  border-radius: 0.5rem;
  background: var(--primary-color);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 150ms ease;
}

.self-registration-success-action:hover {
  background: var(--primary-color-hover);
}

.self-registration-success-action:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  outline-offset: 2px;
}
</style>
