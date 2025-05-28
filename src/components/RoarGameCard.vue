<template>
  <PvCard :id="gameId" :data-completed="completed" class="p-card-game m-4">
    <template #header>
      <div class="p-card-game-status">
        <template v-if="completed">
          <PvInlineMessage severity="success">Game completed!</PvInlineMessage>
        </template>
        <template v-else>
          <PvInlineMessage severity="info">Not completed yet</PvInlineMessage>
        </template>
        <div>{{ statusText }}</div>
      </div>
      <img :src="imgSrc" />
    </template>
    <template #title>
      {{ title }}
    </template>
    <template #content>
      {{ description }}
    </template>
    <template #footer>
      <router-link :to="{ path: 'game/' + gameId }">
        <PvButton :label="playLabel" icon="pi pi-sign-in" />
      </router-link>
      <div class="p-card-game-meta">
        <PvTag v-for="(items, index) in metadata" :key="index" :value="items" />
      </div>
    </template>
  </PvCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PvButton from "primevue/button";
import PvCard from "primevue/card";
import PvInlineMessage from "primevue/inlinemessage";
import PvTag from "primevue/tag";

interface Props {
  gameId: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  imgSrc?: string;
  completed: boolean;
  statusText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  metadata: () => ({}),
  imgSrc: "",
  statusText: "",
});

const playLabel = computed((): string =>
  props.completed ? "Play again" : "Play",
);
</script>

<style lang="scss">
.p-card-game {
  --gray: lightgray;
  --primary: var(--primary-color);

  position: relative;
  box-shadow: none;
  border: 1px solid var(--gray);
  text-align: left;

  // Game details
  // Contains completed status; game count & play button
  .p-card-game-status {
    background: var(--blue-50);
    display: inline-flex;
    align-items: center;
    width: 100%;
    justify-content: space-between;
    border-top-left-radius: 0.25rem;
    border-top-right-radius: 0.25rem;

    > div {
      display: inline-flex;
      padding: 1rem;
      align-items: center;
    }

    .p-inline-message {
      background-color: transparent;
    }
  }

  // link
  // this component should have only 1 router link
  a {
    text-decoration: none;
    color: inherit;

    &:before {
      content: " ";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
  }

  // Footer
  .p-card-footer {
    border-top: 1px solid var(--gray-100);
    display: inline-flex;
    width: 100%;
    justify-content: space-between;

    // override CSS from <PvTag>
    .p-tag {
      background: var(--gray);
      margin-right: 0.5rem;
    }
  }

  // Not completed
  &[data-completed="false"] {
    &:hover {
      border-color: var(--primary);
      color: var(--primary);

      .p-card-game-status,
      .p-card-game-status * {
        background: var(--primary);
        color: white;
      }
    }
  }

  // Completed
  &[data-completed="true"] {
    .p-card-game-status {
      background: var(--green-50);
      color: var(--success);
    }
  }
}
</style>
