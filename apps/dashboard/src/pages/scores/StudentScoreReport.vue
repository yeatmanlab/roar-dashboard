<template>
  <main class="min-h-screen" :class="{ 'bg-white': isPrintMode, 'bg-gray-50': !isPrintMode }">
    <div class="container flex py-4 pb-8 flex-column align-items-around">
      <StudentScoreReport :administration-id="administrationId" :user-id="userId" :org-type="orgType" :org-id="orgId" />
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import StudentScoreReport from '@/containers/StudentScoreReport/StudentScoreReport.vue';

defineProps({
  administrationId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
});

const route = useRoute();

const isPrintMode = computed(() => route.query.print === 'true', { immediate: true });
</script>

<style scoped>
@media (min-width: 768px) {
  .container {
    max-width: 768px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

@media (min-width: 992px) {
  .container {
    max-width: 992px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}
</style>
