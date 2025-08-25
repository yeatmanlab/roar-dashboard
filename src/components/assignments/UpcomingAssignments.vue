<template>
  <div class="assignment assignment--upcoming">
    <div class="assignment__header">
      <PvTag value="Upcoming" class="text-xs uppercase assignment__status --upcoming" />

      <h2 class="assignment__name">
        {{ props.assignment?.publicName || props.assignment?.name }}
      </h2>

      <div class="assignment__dates">
        <div class="assignment__date">
          <i class="pi pi-calendar"></i>
          <small
            ><span class="font-bold">Start: </span>{{ format(props.assignment?.dateOpened, 'MMM dd, yyyy') }}</small
          >
        </div>
        <div class="assignment__date">
          <i class="pi pi-calendar"></i>
          <small><span class="font-bold">End: </span>{{ format(props.assignment?.dateClosed, 'MMM dd, yyyy') }}</small>
        </div>
      </div>
    </div>
    <div class="assignment__tasks">
      <div
        v-for="task in props.assignment?.assessments"
        :key="task?.taskId"
        v-tooltip.top="task?.variantName"
        class="assignment__task"
      ></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AdministrationType } from '@levante-framework/levante-zod';
import { format } from 'date-fns';
import PvTag from 'primevue/tag';

interface Props {
  assignment?: AdministrationType;
}

const props = withDefaults(defineProps<Props>(), {
  assignment: undefined,
});
</script>

<style lang="scss" scoped>
.assignment {
  display: block;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 2rem;
}

.assignment__status {
  &.--current {
    background: rgba(var(--bright-green-rgb), 0.1);
    color: var(--bright-green);
  }

  &.--upcoming {
    background: rgba(var(--bright-yellow-rgb), 0.1);
    color: var(--bright-yellow);
  }

  &.--past {
    background: rgba(var(--bright-red-rgb), 0.1);
    color: var(--bright-red);
  }
}

.assignment__name {
  display: block;
  margin: 0.5rem 0 0;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--gray-600);

  @media (max-width: 1024px) {
    font-size: 1.35rem;
  }
}

.assignment__dates,
.assignment__date {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0 0;
}

.assignment__date {
  gap: 0.25rem;
  margin: 0;
  font-weight: 500;
  color: var(--gray-500);

  .pi {
    margin: -2px 0 0;
  }
}

.assignment__tasks {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  width: 100%;
  height: auto;
  margin: 2rem 0 0;
}

.assignment__task {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 56px;
  min-height: 56px;
  border-radius: 0.75rem;
  background: var(--surface-d);
}
</style>
