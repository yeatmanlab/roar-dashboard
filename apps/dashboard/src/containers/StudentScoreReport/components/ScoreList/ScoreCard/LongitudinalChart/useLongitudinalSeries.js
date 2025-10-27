import { computed } from 'vue';
import { getDialColor } from '@/helpers/reports';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

const SCORE_TYPES = {
  rawScore: { key: 'rawScore', label: 'Raw Score', priority: 1 },
  percentile: { key: 'percentile', label: 'Percentile', priority: 2 },
  standardScore: { key: 'standardScore', label: 'Standard Score', priority: 3 },
};

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

        const rawScore = e?.scores?.rawScore;
        const percentile = e?.scores?.percentileScore ?? e?.scores?.percentile;
        const standardScore = e?.scores?.standardScore;

        const color = getDialColor(props.studentGrade, percentile, rawScore, props.taskId);

        return {
          x,
          y,
          assignmentId: e.assignmentId || e.administrationId || '',
          percentile,
          standardScore,
          color: color || SCORE_SUPPORT_LEVEL_COLORS.ASSESSED,
        };
      });
  });

  const seriesLabel = computed(() => getLabelByScoreType(chosenType.value));
  const seriesStroke = computed(() => '#666666'); // gray line

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
