import { computed } from 'vue';
import { getSupportLevel } from '@/helpers/reports';

const SCORE_TYPES = {
  rawScore: { key: 'rawScore', label: 'Raw Score', color: '#2196F3', priority: 1 },
  percentile: { key: 'percentile', label: 'Percentile', color: '#4CAF50', priority: 2 },
  standardScore: { key: 'standardScore', label: 'Standard Score', color: '#FF9800', priority: 3 },
};

const getColorByScoreType = (t) => SCORE_TYPES[t]?.color ?? '#9C27B0';
const getLabelByScoreType = (t) => SCORE_TYPES[t]?.label ?? 'Score';
const preferredTypes = Object.values(SCORE_TYPES)
  .sort((a, b) => a.priority - b.priority)
  .map((t) => t.key);

export function useLongitudinalSeries(props) {
  const sorted = computed(() => {
    const a = props.longitudinalData || [];
    return [...a].sort((x, y) => new Date(x.date) - new Date(y.date));
  });

  const chosenType = computed(() => preferredTypes.find((t) => sorted.value.some((e) => e.scores?.[t] != null)));

  const series = computed(() => {
    if (!chosenType.value) return [];
    const t = chosenType.value;
    return sorted.value
      .filter((e) => e.scores?.[t] != null && !Number.isNaN(+e.scores[t]))
      .map((e) => {
        const x = new Date(e.date);
        const y = +e.scores[t];
        const s = getSupportLevel(props.studentGrade, e.scores?.percentile, e.scores?.rawScore, props.taskId);
        return {
          x,
          y,
          percentile: e.scores?.percentile ?? null,
          standardScore: e.scores?.standardScore ?? null,
          color: s?.tag_color || getColorByScoreType(t),
        };
      });
  });

  const seriesLabel = computed(() => getLabelByScoreType(chosenType.value));
  const seriesStroke = computed(() => getColorByScoreType(chosenType.value));

  const xDomain = computed(() => {
    if (!series.value.length) return [new Date(), new Date()];
    return [series.value[0].x, series.value[series.value.length - 1].x];
  });

  const yDomain = computed(() => {
    if (!series.value.length) return [0, 1];
    const ys = series.value.map((p) => p.y);
    const min = Math.min(...ys, 0);
    const max = Math.max(...ys);
    return [min, max === min ? min + 1 : max];
  });

  return { series, seriesLabel, seriesStroke, xDomain, yDomain };
}
