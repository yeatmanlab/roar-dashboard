
const getGlobalChartConfig = (scores) => ({
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'default settings to be used for all charts',
    "title": {"anchor": "middle", "fontSize":22},
    data: {
      values: scores,
    },
    /*
    title: {"text": "ROAR Score Distribution by Grade Level", "anchor": "middle", "fontSize":22},
    width: 600,
    height: 200,    */
  });
  
  

  export const getDistributionByGrade = (scores) => {
    return {
        ...getGlobalChartConfig(scores),
        description: 'ROAR Score Distribution by Grade Level',
        title: {"text": "ROAR Score Distribution by Grade Level", },
        "transform": [
            {"calculate": "100 * (datum.theta +5)", "as": "swr_score"},
            //{"filter": "datum.swr_score > 60"}
            ],
        mark: 'bar',
        encoding: {
            row: { field: "grade" },
            // thetaEstimate should be changed to ROAR score
            x: { bin: true, field: 'thetaEstimate' },
            y: { aggregate: 'count' },
            color: { field: 'grade' },
        },
        };
  }