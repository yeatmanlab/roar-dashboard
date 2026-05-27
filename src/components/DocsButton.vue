<template>
  <a :href="href" target="_blank" rel="noopener noreferrer" class="docs-button" data-cy="docs-button">
    <i class="pi pi-book" />
    <span>{{ label }}</span>
  </a>
</template>

<script setup>
defineProps({
  href: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: 'Docs',
  },
});
</script>

<style scoped>
.docs-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
  background-color: white;
  color: var(--docs-btn);
  border: 1px solid var(--docs-btn-border);
  transition:
    background-color 0.2s,
    border-color 0.2s,
    color 0.2s;
}

.docs-button:hover {
  background-color: var(--docs-btn-hover);
  border-color: var(--docs-btn-border);
  color: var(--docs-btn);
}

.docs-button:focus-visible {
  outline: 1px solid var(--docs-btn-border);
  outline-offset: 2px;
}
</style>
