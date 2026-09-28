<template>
  <PvDialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="false"
    :header="t('pageRegister.consent.modalTitle')"
    class="self-registration-consent-dialog"
    data-testid="research-consent-modal"
    @update:visible="handleVisibleChange"
  >
    <div class="self-registration-consent-body">
      <div v-if="loading" class="self-registration-consent-state" role="status" aria-live="polite">
        <span class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>{{ t('pageRegister.consent.loadingDocument') }}</span>
      </div>

      <div v-else-if="loadFailed" class="self-registration-consent-state" role="alert">
        <span class="pi pi-exclamation-circle" aria-hidden="true" />
        <p>{{ t('pageRegister.consent.loadError') }}</p>
        <button type="button" class="self-registration-consent-secondary" @click="$emit('retry')">
          {{ t('pageRegister.consent.retry') }}
        </button>
      </div>

      <template v-else-if="document?.text">
        <div class="self-registration-consent-document">
          <!-- The legal document is converted from Markdown and sanitized before rendering. -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="self-registration-consent-markdown" v-html="renderedDocument" />
        </div>
      </template>
    </div>

    <template #footer>
      <div class="self-registration-consent-footer">
        <button type="button" class="self-registration-consent-secondary" @click="$emit('cancel')">
          {{ t('pageRegister.consent.cancel') }}
        </button>
        <button
          type="button"
          class="self-registration-consent-primary"
          :disabled="loading || loadFailed || !document?.text"
          @click="$emit('confirm')"
        >
          <i class="pi pi-check" aria-hidden="true" />
          {{ t('pageRegister.consent.continue') }}
        </button>
      </div>
    </template>
  </PvDialog>
</template>

<script setup>
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import PvDialog from 'primevue/dialog';
import { i18n } from '@/translations/i18n';

const props = defineProps({
  visible: { type: Boolean, default: false },
  document: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  loadFailed: { type: Boolean, default: false },
});

const emit = defineEmits(['cancel', 'confirm', 'retry']);
const { t } = i18n.global;
const renderedDocument = computed(() => DOMPurify.sanitize(marked.parse(props.document?.text ?? '')));

function handleVisibleChange(visible) {
  if (!visible) emit('cancel');
}
</script>

<style scoped>
:global(.self-registration-consent-dialog) {
  width: min(48rem, calc(100vw - 2rem));
  max-height: min(56rem, calc(100vh - 2rem));
  border-radius: 0.75rem;
}

:global(.self-registration-consent-dialog .p-dialog-content) {
  min-height: 0;
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
}

:global(.self-registration-consent-dialog .p-dialog-header) {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--surface-200);
}

:global(.self-registration-consent-dialog .p-dialog-footer) {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--surface-200);
}

.self-registration-consent-body {
  min-height: 12rem;
}

.self-registration-consent-state {
  display: flex;
  min-height: 12rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--text-color-secondary);
  text-align: center;
}

.self-registration-consent-state p {
  max-width: 32rem;
  margin: 0;
}

.self-registration-consent-document {
  padding: 1.5rem;
  border: 1px solid var(--surface-300);
  border-radius: 0.625rem;
}

.self-registration-consent-markdown {
  color: var(--text-color-secondary);
  font-size: 0.9375rem;
  line-height: 1.65;
}

.self-registration-consent-markdown :deep(h1),
.self-registration-consent-markdown :deep(h2),
.self-registration-consent-markdown :deep(h3),
.self-registration-consent-markdown :deep(h4),
.self-registration-consent-markdown :deep(strong) {
  color: var(--text-color);
}

.self-registration-consent-markdown :deep(a) {
  color: var(--primary-color);
}

.self-registration-consent-markdown :deep(img),
.self-registration-consent-markdown :deep(table) {
  max-width: 100%;
}

.self-registration-consent-markdown :deep(table) {
  border-collapse: collapse;
}

.self-registration-consent-markdown :deep(td),
.self-registration-consent-markdown :deep(th) {
  padding: 0.5rem;
  vertical-align: top;
}

.self-registration-consent-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.self-registration-consent-primary,
.self-registration-consent-secondary {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1.25rem;
  border-radius: 0.5rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.self-registration-consent-secondary {
  border: 1px solid var(--surface-300);
  background: var(--surface-0);
  color: var(--text-color-secondary);
}

.self-registration-consent-primary {
  border: 1px solid var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.self-registration-consent-primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.self-registration-consent-primary:focus-visible,
.self-registration-consent-secondary:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
  outline-offset: 2px;
}

@media (max-width: 36rem) {
  :global(.self-registration-consent-dialog .p-dialog-content),
  :global(.self-registration-consent-dialog .p-dialog-header),
  :global(.self-registration-consent-dialog .p-dialog-footer) {
    padding-right: 1rem;
    padding-left: 1rem;
  }

  .self-registration-consent-document {
    padding: 1rem;
  }

  .self-registration-consent-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }
}
</style>
