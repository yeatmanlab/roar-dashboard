<template>
  <footer class="auth-page-footer">
    <div class="auth-page-footer__language">
      <LanguageSelector />
    </div>
    <div class="auth-page-footer__links">
      <a :href="TERMS_OF_SERVICE_DOCUMENT_PATH" target="_blank" rel="noopener noreferrer">
        {{ $t('pageSignIn.Terms') }}
      </a>
      <a href="https://www.stanford.edu/privacy" target="_blank" rel="noopener noreferrer">
        {{ $t('pageSignIn.Privacy') }}
      </a>
    </div>
  </footer>
</template>

<script setup>
import LanguageSelector from '@/components/LanguageSelector.vue';
import { TERMS_OF_SERVICE_DOCUMENT_PATH } from '@/constants/auth';
</script>

<style scoped>
.auth-page-footer {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-color-secondary);
}

.auth-page-footer__language {
  min-width: 0;
  flex: 1;
}

.auth-page-footer__links {
  display: flex;
  flex: 0 0 auto;
  gap: 1.5rem;
  padding-top: 0.5rem;
}

.auth-page-footer__links a {
  color: inherit;
  font-size: 0.875rem;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.auth-page-footer__links a:hover {
  color: var(--primary-color);
}

@media (max-width: 28rem) {
  .auth-page-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .auth-page-footer__links {
    justify-content: flex-end;
    padding-top: 0;
  }
}
</style>
