<template>
  <div v-html="html.introduction"></div>
  <div id="viz-distribution-by-grade"></div>

  <div v-html="html.supportSection1"></div>
  <div id="viz-normed-percentile-distribution"></div>
  <!-- <div v-html="html.supportSection2"></div> -->

  <div v-html="html.automaticity1"></div>
  <div id="viz-first-grade-percentile-distribution"></div>
  <!-- <div v-html="html.automaticity2"></div> -->

  <div v-html="html.supportClassificationDistributions"></div>
  <div id="viz-stacked-support-by-grade"></div>

  <div v-html="html.automaticityDistributionsFirstGrade"></div>
  <div id="viz-automaticity-distributions-first-grade"></div>
  
  <div v-html="html.studentScoreInformation"></div>
  <DataTable :data="data" class="display">
    <thead>
      <tr>
        <th>A</th>
        <th>B</th>
      </tr>
    </thead>
  </DataTable>

  <div v-html="html.interpretation"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { marked } from 'marked';
import { useScoreStore } from "@/store/scores";
import * as markdown from "@/components/reportMarkdownSWR";
import DataTable from 'datatables.net-vue3'
import DataTablesLib from 'datatables.net';

DataTable.use(DataTablesLib);

const data = [
  [1, 2],
  [3, 4],
];

const scoreStore = useScoreStore();

const html = Object.fromEntries(Object.entries(markdown).map(([k, v]) => [k, marked.parse(v(scoreStore))]));

const globalChartConfig = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  description: 'default settings to be used for all charts',
  data: {
    values: scoreStore.scores,
  },
}

const distributionByGrade = {
  // ...globalChartConfig,
  description: 'ROAR Score Distribution by Grade Level',
  title: {"text": "ROAR Score Distribution by Grade Level", "anchor": "middle","fontSize":24},
  config: {view: {"stroke": null} },
  data: {
    values: scoreStore.scores,
  },
  "transform": [
    {"calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score"},
  ],
  mark: 'bar',
  "height": 50,
  "width": 400,
  encoding: {
    facet: {field: "grade",
            type: "nominal",
            columns: 1,
            title: "Grade",
            sort: ['Kindergarten',1,2,3,4,5,6,7,8,9,10,11,12],
            spacing: 5
   },
   color: {field: 'grade', 
          type: "nominal",
          "sort": ['Kindergarten',1,2,3,4,5,6,7,8,9,10,11,12],
          legend: null
    },
    // thetaEstimate should be changed to ROAR score
    x: { bin: true, field: 'swr_score', "title": "ROAR Score", "bin": { "step": 50 }},
    y: { aggregate: 'count', "title": "count", 
        axis : {orient: "right"}}
   
    

  }
};

const normedPercentileDistribution = {
  // ...globalChartConfig,
  description: 'Distribution of Normed Percentiles (all grades)',
  title: { "text": "Distribution of Woodcock-Johnson Equivalent Percentiles", "anchor": "middle", "fontSize": 24 },
  "height": 200,
  "width": 600,
  data: { values: scoreStore.scores, },
  "transform": [
    //TODO replace fake calculation with real percent conversion
    {"calculate": "100 * (datum.thetaEstimate +4)/8", "as": "swr_percentile" },
    {"calculate": "datum.swr_percentile <= 25? 'Extra Support Needed': datum.swr_percentile <50? 'Some Support Needed': 'Average or Above Average' ",
              "as": "Support" }
  ],
  mark: 'bar',
  encoding: {
    // thetaEstimate should be changed to percentile
    x: {
      bin: true,
      field: 'swr_percentile',
      "title": "Percentile (relative to national norms)",
      "scale": { "domain": [0, 100] },
      "bin": { "step": 5 },
      "axis": {"tickMinStep":1},
    },
    y: { aggregate: 'count', "title": "count of students" },
    "color": {"field": "Support",
      title: "Support",
      "sort": ['Extra Support Needed', 'Some Support Needed', 'Average or Above Average'],
      scale: {
                domain: ["Extra Support Needed", "Some Support Needed", "Average or Above Average"],
              range: ["#cc79a7", "#f0e442", "#0072b2"]
              }
      }
    //"color": {"condition": {"test": "datum['swr_score'] < 500", "value": "black"},"value": "red"},
  },
};

const firstGradePercentileDistribution = {
  // ...globalChartConfig,
  description: 'Distribution of First Grade Woodcock-Johnson Equivalent Percentiles',
  title: { "text": "Distribution of First Grade Woodcock-Johnson Equivalent Percentiles", "anchor": "middle", "fontSize": 24 },
  "height": 100,
  "width": 600,
  data: { values: scoreStore.scores, },
  "transform": [
    { "calculate": "100 * (datum.thetaEstimate +4)/8", "as": "swr_percentile" },
    {"filter": "datum.grade <= 1"},  
    {"calculate": "datum.swr_percentile <= 50? 'Limited': 'Average or Above Average' ","as": "Automaticity" },
  ],
  mark: 'bar',
  encoding: {
    x: {
      bin: true,
      field: 'swr_percentile',
      "title": "Percentile (relative to national norms)",
      "scale": { "domain": [0, 100],  },
      "bin": { "step": 5, "minstep": 1, "extent":[0,100], },
      "axis": {"tickMinStep":1},
    },
    y: { aggregate: 'count', 
         "title": "count of students",
         "axis": {"tickMinStep":1},
       },
    "color": {"field": "Automaticity",
      title: "Automaticity",
      "sort": ['Limited', 'Average or Above Average'],
      scale: {
                domain: ["Limited", "Average or Above Average"],
                range: ["#342288", "#44aa99"]
              }
      }
  },
};

const stackedSupportByGrade = {
  description: 'Distribution of Support Classification by Grade Level',
  title: {"text": "Distribution of Support Classification by Grade Level", "anchor": "middle","fontSize":24},
  "height": 200,
  "width": 600,
  data: {values: scoreStore.scores,},
  "transform": [
    {"calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score"},
    { "calculate": "100 * (datum.thetaEstimate +4)/8", "as": "swr_percentile" },
    {"calculate": "datum.swr_percentile <= 25? 'Extra Support Needed': datum.swr_percentile <=50? 'Some Support Needed': 'Average or Above Average' ",
              "as": "Support" },
    {"calculate": "indexof(['Extra Support Needed', 'Some Support Needed', 'Average or Above Average'], datum.Support)",
      "as": "order" },
    {"filter": "datum.grade >= 2"},  // TODO fix, should be 1, using 2 to test

    //{"filter": "datum.swr_score > 60"}
  ],
  mark: 'bar',
  encoding: {
    x: { aggregate: 'count', "title": "# of students", "axis": { "tickMinStep":1 } },
    y: { bin: false, 
      "type": "ordinal",
      field: 'grade', 
      "title": "grade", 
      "axis": { "tickBand": "extent", "tickMinStep":1 },
    },
           color: {
              field: "Support",
              type: "nominal",
              
              scale: {
                domain: ['Extra Support Needed', 'Some Support Needed', 'Average or Above Average'],
                range: ["#cc79a7", "#f0e442", "#0072b2"]
              
              },
              title: "Support"
            },
            order: { field: "order", type: "nominal"} 
  }
};

const stackedAutomaticityFirstGrade = {
  description: 'Distribution of Automaticity in First Grade',
  title: {"text": "Distribution of Automaticity in First Grade", "anchor": "middle","fontSize":24},
  "height": 100,
  "width": 600,
  data: {values: scoreStore.scores,},
  "transform": [
    {"calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score"},
    {"calculate": "100 * (datum.thetaEstimate +4)/8", "as": "swr_percentile" },
    {"calculate": "datum.swr_percentile <= 50? 'Limited': 'Average or Above Average' ","as": "Automaticity" },
    {"calculate": "indexof(['Limited', 'Average or Above Average'], datum.Automaticity)",
      "as": "order" },
    {"filter": ("datum.grade <= 1") },  
  ],
  mark: 'bar',
  encoding: {
    x: { 
      aggregate: 'count', 
      "title": "# of students", 
      "axis": { "tickBand": "extent", "tickMinStep":1 },
    },
    y: { 
      bin: false, 
      field: 'grade', 
      "title": "grade", 
      "axis": { "tickBand": "extent", },
    },
           color: {
              field: "Automaticity",
              type: "nominal",
              
              scale: {
                domain: ['Limited',  'Average or Above Average'],
              range: ["#342288", "#44aa99"]
              
              },
              title: "Automaticity"
            },
            order: { field: "order", type: "nominal"} 
  }
};


const draw = async () => {
  await embed('#viz-distribution-by-grade', distributionByGrade);
  await embed('#viz-normed-percentile-distribution', normedPercentileDistribution);
  await embed('#viz-first-grade-percentile-distribution', firstGradePercentileDistribution);
  await embed('#viz-stacked-support-by-grade', stackedSupportByGrade);
  await embed('#viz-automaticity-distributions-first-grade', stackedAutomaticityFirstGrade);

};

onMounted(() => {
  draw()
})
</script>

<style>
p {
  text-align: left;
  font-family:   "Helvetica Neue", "Palatino Linotype", sans-serif;
}
</style>
