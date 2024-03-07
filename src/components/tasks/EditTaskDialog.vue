<template>
  <PvButton label="Show" @click="visible = true" />
  <PvDialog v-model:visible="props.visible" :draggable="false" modal header="Edit Variant" :style="{ width: '25rem' }">
    <div class="flex align-items-center justify-content-flex-end">
      <div class="flex flex-column">
        <div class="text-3xl font-bold">
          {{ assessment.task.id }}
        </div>
      </div>
      <div class="flex">
        <img :src="assessment.task.image" class="w-4" />
      </div>
    </div>
    <span class="p-text-secondary block mb-5">Update your information.</span>
    <div class="flex align-items-center gap-3 mb-3">
      <label for="username" class="font-semibold w-6rem">Username</label>
      <PvInputText id="username" class="flex-auto" autocomplete="off" />
    </div>
    <div class="flex align-items-center gap-3 mb-5">
      <label for="email" class="font-semibold w-6rem">Email</label>
      <PvInputText id="email" class="flex-auto" autocomplete="off" />
    </div>
    <div class="flex justify-content-end gap-2">
      <PvButton type="button" label="Cancel" severity="secondary" @click="props.visible = false"></PvButton>
      <PvButton type="button" label="Save" @click="props.visible = false"></PvButton>
    </div>
  </PvDialog>
</template>

<script setup>
import { ref } from 'vue';
const visible = ref(false);
const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  assessment: {
    type: Object,
    required: true,
  },
});
</script>
