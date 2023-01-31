<template>
    <div id="viz"></div>
</template>

<script>
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";

const scoreStore = useScoreStore();

export default {
    name: 'BarChart',
    mounted() {
        this.draw()
    },
  data() {
    let values = [];

    for (let row of scoreStore.scores) {
      values.push({
        correct: row.correct
      });
    }
    return {
            chart1: {
                $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
                description: 'A histogram of the number of correct responses.',
                data: {
                    values,
                },
                mark: 'bar',
                encoding: {
                  x: { bin: true, field: 'correct' },
                  y: { aggregate: "count" },
                },
            },
        }
    },
    methods: {
        async draw() {
            const result = await embed('#viz', this.chart1)
        },
    },
}
</script>