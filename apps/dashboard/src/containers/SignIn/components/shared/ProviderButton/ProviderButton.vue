<template>
  <PvButton :class="['w-full p-2', btnClass]" type="button" :data-cy="dataCy" @click="$emit('click')">
    <img v-if="imgSrc" :src="imgSrc" alt="" class="mr-2" style="width: 18px; height: 18px; object-fit: contain" />
    <i v-else-if="icon" :class="['mr-2', icon]" aria-hidden="true"></i>
    <span>{{ label }}</span>
  </PvButton>
</template>

<script setup>
import PvButton from 'primevue/button';

defineProps({
  label: { type: String, default: '' },
  imgSrc: { type: String, default: '' }, // provider logos
  icon: { type: String, default: '' },
  btnClass: { type: String, default: '' },
  dataCy: { type: String, default: '' },
});
defineEmits(['click']);
</script>
