<template>
  <div
    :class="`assignment-card ${props.isActive ? '--active' : ''}`"
    @click="props.onClick && props.onClick(props.data, props.status)"
  >
    <div class="assignment-card__content">
      <div class="assignment-card__header">
        <h4 class="assignment-card__name">
          <i v-if="props.status === ASSIGNMENT_STATUSES.UPCOMING" :class="`pi pi-lock --${props.status}`"></i>
          <i v-else-if="isAssignmentCompleted" :class="`pi pi-check-circle --${props.status}`"></i>
          {{ props?.data?.publicName || props?.data?.name }}
        </h4>

        <div v-if="props?.data?.dateOpened && props?.data?.dateClosed" class="assignment-card__dates">
          <i class="pi pi-calendar"></i>
          <small>{{ format(props?.data?.dateOpened, 'MMM dd, yyyy') }}</small> —
          <small>{{ format(props?.data?.dateClosed, 'MMM dd, yyyy') }}</small>
        </div>
      </div>
    </div>

    <div v-if="props.isActive" class="assignment-card__selected-icon">
      <i class="pi pi-angle-right"></i>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ASSIGNMENT_STATUSES } from '@/constants';
import { AdministrationType } from '@levante-framework/levante-zod';
import { format } from 'date-fns';
import { computed } from 'vue';

interface Props {
  data: AdministrationType;
  isActive: boolean;
  status: string;
  onClick?: (assignment: AdministrationType, status: string) => void;
}

const props = defineProps<Props>();

const isAssignmentCompleted = computed(() => props.data?.assessments?.every((assessment) => !!assessment?.completedOn));
</script>

<style lang="scss" scoped>
.assignment-card {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0.75rem;
  border: 1px solid var(--surface-d);
  border-radius: 0.75rem;
  cursor: pointer;

  &.--active {
    background: rgba(var(--bright-yellow-rgb), 0.1);
    border: 1px solid var(--bright-yellow);

    .assignment-card__name {
      color: var(--bright-yellow);
    }
  }
}

.assignment-card__header {
  display: block;
  width: 100%;
  height: auto;
  margin: 0;
}

.assignment-card__content {
  display: block;
  flex: 1;
  margin: 0;
}

.assignment-card__selected-icon {
  color: var(--bright-yellow);
}

.assignment-card__name {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-weight: 700;
  color: var(--gray-600);

  .pi {
    &.--upcoming {
      color: var(--gray-500);
    }

    &.--current,
    &.--past {
      color: var(--bright-green);
    }
  }
}

.assignment-card__dates {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 0.25rem;
  margin: 0.5rem 0 0;
  font-weight: 500;
  color: var(--gray-500);

  .pi {
    margin: -2px 0 0;
  }
}
</style>
