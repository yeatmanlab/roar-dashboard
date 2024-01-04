<template>
  <div class="sidebar-container">
    <Menu v-model:visible="visible" popup="true">
      <ul v-if="actions" class="sidebar-actions">
        <li class="sidebar-title"><strong>Actions</strong></li>
        <li v-for="(action, index) in actions" :key="index">
          <router-link :key="index" :to="action.buttonLink">
            <PvButton :label="action.title" rounded :icon="action.icon" />
          </router-link>
        </li>
      </ul>
    </Menu>
    <PvButton v-tooltip.right="'Click to open the menu'" label="Menu" icon="pi pi-bars" @click="visible = true" />
  </div>
</template>

<script setup>
import { ref } from 'vue';

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  userInfo: { type: Object, required: false, default: () => ({}) },
  actions: { type: Array, required: false, default: () => [] },
});

const visible = ref(false);
</script>
