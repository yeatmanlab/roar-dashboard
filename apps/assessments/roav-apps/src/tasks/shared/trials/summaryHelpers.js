import jsPsychCallFunction from "@jspsych/plugin-call-function";
import jsPsychHtmlButtonResponse from "@jspsych/plugin-html-button-response";
import { jsPsych } from "../helpers/taskSetup";
import { sessionGet } from "../helpers/sessionHelpers";
import { SESSION_KEYS as SK } from "../helpers/sessionKeys";
import { wrapAsJsPsychTrial } from "../helpers/jspsychHelpers";
import { AssessmentStage } from "../helpers/namingHelpers";

const WIDTH_PLOT_DEF = 900;
const HEIGH_PLOT_DEF = 320;
const NUM_TRIALS_LAST_AVERAGE = 3;

const paramsDef = {
  labelY: "label",
  title: "title",
};

export const summary = {};

const initSummary = (paramsIn) => {
  const params = { ...paramsDef, ...paramsIn };
  const infos = [];

  return {
    addInfo: (info) => {
      infos.push(info);
    },
    getInfos: () => infos,
    getParams: () => params,
  };
};

export const t_initSummary = (paramsIn = {}) =>
  wrapAsJsPsychTrial(() => {
    Object.assign(summary, initSummary(paramsIn));
  });

export const t_writeSummary = () => ({
  type: jsPsychCallFunction,
  func: () => {},
  on_finish: () => {
    const infos = summary.getInfos();

    jsPsych.data.addDataToLastTrial({
      save_trial: true,
      assessment_stage: AssessmentStage.DATA,
      correct: true,
      type_trial: "write-summary",
      id_trial: "write-summary",
      pid: sessionGet(SK.CONFIG).pid,
      summary: infos,
    });
  },
});

function plotSummary(container, infosIn, params) {
  const W = container.clientWidth || WIDTH_PLOT_DEF;
  const H = container.clientHeight || HEIGH_PLOT_DEF;
  const margin = 50;

  const colors = {
    quest: "#000000",
    catch: "#ff0000",
    const: "#00bb00",
  };

  const infos = infosIn;

  const n = infos.length;
  const valuesAll = infos.flatMap((info) => [
    info.quest.val_sample,
    info.quest.val_mean,
    info.quest.val_low,
    info.quest.val_high,
  ]);

  let yMin = Math.min(...valuesAll);
  let yMax = Math.max(...valuesAll);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  yMin = 0;
  yMax = 1;

  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;

  const xScale = (i) => margin + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yScale = (y) => margin + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  const svgNS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}) => {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([k, v]) => {
      node.setAttribute(k, v);
    });
    return node;
  };

  const svg = el("svg", {
    width: "100%",
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
  });
  svg.style.display = "block";

  svg.appendChild(
    el("rect", { x: 0, y: 0, width: W, height: H, fill: "white" }),
  );

  const numTail = NUM_TRIALS_LAST_AVERAGE;
  const tail = infos
    .slice(-numTail)
    .map((d) => d.quest.val_mean)
    .filter(Number.isFinite);
  const valueFinal =
    tail.length > 0 ? tail.reduce((sum, v) => sum + v, 0) / tail.length : null;

  const title = el("text", {
    x: W / 2,
    y: 24,
    "text-anchor": "middle",
    "font-size": 16,
    "font-family": "system-ui, sans-serif",
    "font-weight": "600",
    fill: "black",
  });
  title.textContent = `${params.title}: ${valueFinal.toFixed(2)}`;
  svg.appendChild(title);

  const axis = el("g", { stroke: "black", "stroke-width": 1 });
  axis.appendChild(
    el("line", {
      x1: margin,
      y1: H - margin,
      x2: W - margin,
      y2: H - margin,
    }),
  );
  axis.appendChild(
    el("line", {
      x1: margin,
      y1: margin,
      x2: margin,
      y2: H - margin,
    }),
  );
  svg.appendChild(axis);

  const ticks = el("g", {
    fill: "black",
    "font-size": 11,
    "font-family": "system-ui, sans-serif",
  });
  const axisLabels = el("g", {
    fill: "black",
    "font-size": 12,
    "font-family": "system-ui, sans-serif",
  });
  const xLabel = el("text", { x: W / 2, y: H - 10, "text-anchor": "middle" });
  xLabel.textContent = "trials";
  axisLabels.appendChild(xLabel);
  const yLabel = el("text", {
    x: 14,
    y: H / 2,
    "text-anchor": "middle",
    transform: `rotate(-90 14 ${H / 2})`,
  });
  yLabel.textContent = params.labelY;
  axisLabels.appendChild(yLabel);
  svg.appendChild(axisLabels);

  const maxXTicks = 10;
  const step = Math.max(1, Math.ceil(n / maxXTicks));
  for (let i = 0; i < n; i += step) {
    const x = xScale(i);
    ticks.appendChild(
      el("line", {
        x1: x,
        y1: H - margin,
        x2: x,
        y2: H - margin + 5,
        stroke: "black",
      }),
    );
    const t = el("text", { x, y: H - margin + 18, "text-anchor": "middle" });
    t.textContent = i;
    ticks.appendChild(t);
  }

  const yTickStep = 0.05;
  for (let yVal = 0; yVal <= 1 + 1e-9; yVal += yTickStep) {
    const y = yScale(yVal);

    svg.appendChild(
      el("line", {
        x1: margin,
        y1: y,
        x2: W - margin,
        y2: y,
        stroke: "#e5e7eb",
        "stroke-width": 1,
      }),
    );

    const t = el("text", { x: margin - 8, y: y + 4, "text-anchor": "end" });
    t.textContent = yVal.toFixed(2);
    ticks.appendChild(t);
  }
  svg.appendChild(ticks);

  const legend = el("g", {
    fill: "black",
    "font-size": 11,
    "font-family": "system-ui, sans-serif",
  });
  const legendItems = [
    { label: "quest", color: colors.quest },
    { label: "catch", color: colors.catch },
    { label: "const", color: colors.const },
    { label: "", color: "rgba(0,0,0,0)" }, // spacer row
    { label: "correct", color: "black" },
    { label: "incorrect", color: "transparent", stroke: "black" },
  ];
  const legendX = W - margin - 90;
  const legendY = margin + 30;
  const rowH = 14;
  legendItems.forEach((item, idx) => {
    const y = legendY + idx * rowH;
    legend.appendChild(
      el("circle", {
        cx: legendX + 5,
        cy: y - 3,
        r: 4,
        fill: item.color,
        stroke: item.stroke ?? "none",
        "stroke-width": item.stroke ? 2 : 0,
      }),
    );
    const t = el("text", { x: legendX + 14, y, "text-anchor": "start" });
    t.textContent = item.label;
    legend.appendChild(t);
  });
  svg.appendChild(legend);

  const questPoints = infos.map((d, i) => ({ ...d, i }));

  if (questPoints.length >= 2) {
    const ptsMid = questPoints
      .map((d) => `${xScale(d.i)},${yScale(d.quest.val_mean)}`)
      .join(" ");
    const ptsUp = questPoints
      .map((d) => `${xScale(d.i)},${yScale(d.quest.val_high)}`)
      .join(" ");
    const ptsDn = questPoints
      .map((d) => `${xScale(d.i)},${yScale(d.quest.val_low)}`)
      .join(" ");

    const band = el("polygon", {
      points: `${ptsUp} ${questPoints
        .slice()
        .reverse()
        .map((d) => `${xScale(d.i)},${yScale(d.quest.val_low)}`)
        .join(" ")}`,
      fill: colors.quest,
      "fill-opacity": 0.1,
      stroke: "none",
    });
    svg.appendChild(band);

    svg.appendChild(
      el("polyline", {
        points: ptsUp,
        fill: "none",
        stroke: colors.quest,
        "stroke-width": 1,
        "stroke-opacity": 0.35,
      }),
    );
    svg.appendChild(
      el("polyline", {
        points: ptsDn,
        fill: "none",
        stroke: colors.quest,
        "stroke-width": 1,
        "stroke-opacity": 0.35,
      }),
    );

    svg.appendChild(
      el("polyline", {
        points: ptsMid,
        fill: "none",
        stroke: colors.quest,
        "stroke-width": 2,
      }),
    );
  }

  const dots = el("g");
  infos.forEach((d, i) => {
    const c = colors[d.subtype_trial] ?? "gray";
    const cx = xScale(i);
    const cy = yScale(d.quest.val_sample);

    const dot = el("circle", {
      cx,
      cy,
      r: 4,
      fill: d.correct ? c : "none",
      stroke: c,
      "stroke-width": 2,
    });
    dots.appendChild(dot);
  });
  svg.appendChild(dots);

  // eslint-disable-next-line no-param-reassign
  container.innerHTML = "";
  container.appendChild(svg);
}

export const t_plotSummary = () => ({
  type: jsPsychHtmlButtonResponse,
  stimulus: `
      <div id="plot" style="width:60svw; height:40svh; margin:0 auto 20svh;"></div>`,
  choices: ["NEXT"],
  button_html: ["<button class='shared-tech-button-medium'>%choice%</button>"],
  on_load: () => {
    const infos = summary.getInfos();
    const params = summary.getParams();
    plotSummary(document.getElementById("plot"), infos, params);
  },
});
