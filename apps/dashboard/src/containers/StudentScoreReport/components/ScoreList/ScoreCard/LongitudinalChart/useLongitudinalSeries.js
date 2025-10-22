import { computed } from 'vue';
import { getDialColor, supportLevelColors } from '@/helpers/reports';

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

        const rawScore = e.scores.rawScore;
        const percentile = e.scores.percentileScore ?? e.scores.percentile ?? null;
        const standardScore = e.scores.standardScore ?? null;

        const color = getDialColor(props.studentGrade, percentile, rawScore, props.taskId);
        console.log('[DEBUG] Point:', {
          taskId: props.taskId,
          grade: props.studentGrade,
          percentile,
          rawScore,
          date: x.toISOString(),
          score: y,
          colorFromDialColor: color,
          finalColor: color || supportLevelColors.Assessed,
        });
        return {
          x,
          y,
          assignmentId: e.assignmentId || e.administrationId || '',
          percentile,
          standardScore,
          color: color || supportLevelColors.Assessed,
        };
      });
  });

  const seriesLabel = computed(() => getLabelByScoreType(chosenType.value));
  const seriesStroke = computed(() => supportLevelColors.Assessed);

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
