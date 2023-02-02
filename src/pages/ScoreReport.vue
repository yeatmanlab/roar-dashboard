<template>
  <h1>{{ scoreStore.taskId }}</h1>
  <p>This is an introductory paragraph. Score reports are amazing!</p>
  <div id="distribution-by-grade"></div>
  <p>This is another exquisitely written paragraph!</p>
  <div id="normed-percentile-distribution"></div>
  <p>Yet more amazing explanation!</p>
  <div id="stacked-support-by-grade"></div>

</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";
import { getDistributionByGrade } from "@/helpers/plotting.js"

const scoreStore = useScoreStore();

const debugGlobalChartConfig =  {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'default settings to be used for all charts',
    data: {
      values: scoreStore.scores,
    },

  };
  

  const debugDistributionByGrade = {
        //...debugGlobalChartConfig,
        description: 'ROAR Score Distribution by Grade Level',
        title: {"text": "ROAR Score Distribution by Grade Level", "anchor": "middle","fontSize":24},
        "height": 75,
        "width": 600,
        data: {
              values: scoreStore.scores,
              },
        "transform": [
            {"calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score"},
            //{"filter": "datum.swr_score > 60"}
            ],
        mark: 'bar',
        encoding: {
            row: { field: "grade" },
            // thetaEstimate should be changed to ROAR score
            x: { bin: true, field: 'swr_score', "title": "ROAR Score", },
            y: { aggregate: 'count', "title": "# of students" },
            color: { field: 'grade' },
        },
        
  };



// TODO look at the colors in this example: https://vega.github.io/vega-lite/examples/bar_heatlane.html
const debugNormedPercentileDistribution = {
  //...debugGlobalChartConfig,
  description: 'Distribution of Normed Percentiles (all grades)',
  title: {"text": "Distribution of Woodcock-Johnson Equivalent Percentiles", "anchor": "middle","fontSize":24},
  "height": 200,
  "width": 600,
  data: {values: scoreStore.scores, },
  "transform": [
            //TODO replace fake calculation with real percent conversion
            {"calculate": "100 * (datum.thetaEstimate +4)/8", "as": "swr_percentile"}, 
            ],
  mark: 'bar',

  encoding: {
    // thetaEstimate should be changed to percentile
    x: { bin: true, 
         field: 'swr_percentile', 
         "title": "Percentile (relative to national norms)",
         "scale": {"domain": [0,100]},
         //"bin": {"maxbins": 10, "minstep":5},},
         //"bin": {"divide":[5,2]},
         "bin": {"step": 5},

    },
    y: { aggregate: 'count', "title": "count of students" },    
    //"color": {"condition": {"test": "datum['swr_score'] < 500", "value": "black"},"value": "red"},

  },
};

const debugStackedSupportByGrade = {
/*
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {"url": "data/barley.json"},
  "mark": "bar",
  "encoding": {
    "x": {"aggregate": "sum", "field": "yield"},
    "y": {"field": "variety"},
    "color": {"field": "site"}
  }
  */

  description: 'Distribution of Support Classificaiton by Grade Level',
        title: {"text": "Distribution of Support Classificaiton by Grade Level", "anchor": "middle","fontSize":24},
        "height": 200,
        "width": 600,
        data: {values: scoreStore.scores,},
        "transform": [
            {"calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score"},
            //{"filter": "datum.swr_score > 60"}
            ],
        
        mark: 'bar',
        encoding: {
            //row: { field: "grade" },
            x: { aggregate: 'count', "title": "# of students" },
            y: { bin: true, 
                field: 'grade', 
                "title": "grade", 
                "axis": { "tickBand": "extent" },
                }, 
            
            //"x": {"aggregate": "grade", /*"field": "support_level"*/},
            //color: { field: 'grade' },
            //"color": {"condition": {"test": "datum['swr_score'] < 500", "value": "black"},"value": "red"},

        },

  }

const draw = async () => {
  await embed('#distribution-by-grade', debugDistributionByGrade);
  await embed('#normed-percentile-distribution', debugNormedPercentileDistribution);
  await embed('#stacked-support-by-grade', debugStackedSupportByGrade);

  //await embed('#distribution-by-grade', getDistributionByGrade(scoreStore.scores));
};

onMounted(() => {
  draw()
})
</script>

<style>
</style>