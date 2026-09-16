<template>
  <div
    class="self-registration-consent-status"
    :class="{
      'self-registration-consent-status--complete': accepted,
      'self-registration-consent-status--invalid': showError,
    }"
    data-testid="research-consent-status"
  >
    <span class="self-registration-consent-status-icon" aria-hidden="true">
      <i :class="accepted ? 'pi pi-check-circle' : 'pi pi-file-edit'" />
    </span>
    <div class="self-registration-consent-status-copy">
      <strong>{{
        accepted ? t('pageRegister.consent.completedTitle') : t('pageRegister.consent.requiredTitle')
      }}</strong>
      <span>{{
        accepted ? t('pageRegister.consent.completedDescription') : t('pageRegister.consent.requiredDescription')
      }}</span>
      <small v-if="showError" id="account-owner-research-consent-error" class="self-registration-consent-error">
        {{ t('pageRegister.consent.requiredError') }}
      </small>
      <small v-if="loadFailed" class="self-registration-consent-error" role="alert">
        {{ t('pageRegister.consent.loadError') }}
      </small>
    </div>
    <button
      type="button"
      class="self-registration-consent-action"
      :disabled="loading"
      :aria-invalid="showError"
      :aria-describedby="showError ? 'account-owner-research-consent-error' : undefined"
      @click="$emit(loadFailed ? 'retry' : 'review')"
    >
      <span v-if="loading" class="pi pi-spin pi-spinner" aria-hidden="true" />
      {{
        loading
          ? t('pageRegister.consent.loading')
          : loadFailed
            ? t('pageRegister.consent.retry')
            : t('pageRegister.consent.review')
      }}
    </button>
  </div>
</template>

<script setup>
import { i18n } from '@/translations/i18n';

defineProps({
  accepted: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadFailed: { type: Boolean, default: false },
  showError: { type: Boolean, default: false },
});

defineEmits(['review', 'retry']);

const { t } = i18n.global;
</script>

<style scoped>
.self-registration-consent-status {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  border: 1px solid var(--surface-300);
  border-radius: 0.5rem;
  background: var(--surface-50);
}

.self-registration-consent-status--complete {
  border-color: color-mix(in srgb, var(--green-600) 35%, var(--surface-300));
}

.self-registration-consent-status--invalid {
  border-color: var(--bright-red);
}

.self-registration-consent-status-icon {
  color: var(--primary-color);
  font-size: 1.125rem;
}

.self-registration-consent-status--complete .self-registration-consent-status-icon {
  color: var(--green-600);
}

.self-registration-consent-status-copy {
  display: grid;
  gap: 0.125rem;
  color: var(--text-color-secondary);
  font-size: 0.75rem;
  line-height: 1.4;
}

.self-registration-consent-status-copy strong {
  color: var(--text-color);
  font-size: 0.8125rem;
}

.self-registration-consent-error {
  color: var(--bright-red);
}

.self-registration-consent-action {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--primary-color);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.self-registration-consent-action:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  outline-offset: 3px;
}

.self-registration-consent-action:disabled {
  cursor: wait;
  opacity: 0.7;
}

@media (max-width: 28rem) {
  .self-registration-consent-status {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .self-registration-consent-action {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
