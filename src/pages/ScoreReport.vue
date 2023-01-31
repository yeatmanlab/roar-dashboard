<template>
  <h1>{{ scoreStore.taskId }}</h1>
  <div id="viz"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";

const scoreStore = useScoreStore();

const chart1 = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  description: 'A histogram of the number of correct and incorrect responses.',
  data: {
    values: scoreStore.scores,
  },
  vconcat: [
    {
      mark: 'bar',
      encoding: {
        x: { bin: true, field: 'correct' },
        y: { aggregate: "count" },
      },
    },
    {
      mark: 'bar',
      encoding: {
        x: { bin: true, field: 'incorrect' },
        y: { aggregate: "count" },
      },
    },
  ],
};

const draw = async () => {
  const result = await embed('#viz', chart1)
};

onMounted(() => {
  draw()
})
</script>

<style>
</style>