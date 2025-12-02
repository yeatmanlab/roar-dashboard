<template>
  <PvButton class="w-full p-2" type="button" :data-cy="dataCy" @click="$emit('click')">
    <div class="flex flex-row align-items-center w-full gap-2">
      <img v-if="imgSrc" :src="imgSrc" :alt="imgAlt" class="flex p-1 w-1 object-contain" />
      <i v-else-if="icon" :class="['flex p-1 w-1', icon]" aria-hidden="true" />
      <span>{{ label }}</span>
    </div>
  </PvButton>
</template>

<script setup>
import PvButton from 'primevue/button';

defineProps({
  label: { type: String, default: '' },
  imgSrc: { type: String, default: '' },
  imgAlt: { type: String, default: '' },
  icon: { type: String, default: '' },
  dataCy: { type: String, default: '' },
});

defineEmits(['click']);
</script>
