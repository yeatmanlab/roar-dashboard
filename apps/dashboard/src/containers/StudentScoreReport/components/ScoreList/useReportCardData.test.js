import { describe, it, expect } from 'vitest';
import { useReportCardData } from './useReportCardData';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

// Pass-through translator so assertions can match i18n keys directly.
const t = (key) => key;

const makeTask = (overrides = {}) => ({
  taskId: '11111111-1111-1111-1111-111111111111',
  taskSlug: 'swr',
  taskName: 'Word',
  orderIndex: 0,
  scores: { rawScore: 500, percentile: 50, standardScore: 100 },
  supportLevel: 'achievedSkill',
  reliable: true,
  optional: false,
  completed: true,
  engagementFlags: [],
  tags: [],
  historicalScores: [],
  ...overrides,
});

const cards = (tasks, grade = '3', taskScoringVersions = {}) =>
  useReportCardData({ reportTasks: tasks, studentGrade: grade, taskScoringVersions, t }).computedTaskData.value;

describe('useReportCardData', () => {
  it('builds the displayed score from backend values with the support-level color', () => {
    const [card] = cards([makeTask()], '3');
    expect(card.taskId).toBe('swr');
    expect(card.scoreToDisplay).toBe('percentileScore'); // grade < 6, normed
    expect(card.rawScore.value).toBe(500);
    expect(card.percentileScore.value).toBe(50);
    expect(card.standardScore.value).toBe(100);
    expect(card.percentileScore.supportColor).toBe(SCORE_SUPPORT_LEVEL_COLORS.ABOVE);
  });

  it('surfaces the standard score for grade >= 6', () => {
    const [card] = cards([makeTask()], '8');
    expect(card.scoreToDisplay).toBe('standardScore');
  });

  it('renders a neutral dial (no color) for optional tasks', () => {
    const [card] = cards([makeTask({ optional: true })], '3');
    expect(card.percentileScore.supportColor).toBeUndefined();
  });

  it('builds type + reliability tags from the backend flags (engagementFlags as an array)', () => {
    const [reliable] = cards([makeTask()], '3');
    expect(reliable.tags).toHaveLength(2);
    expect(reliable.tags[0].value).toBe('scoreReports.required');
    expect(reliable.tags[1].value).toBe('scoreReports.reliable');

    const [unreliable] = cards([makeTask({ reliable: false, engagementFlags: ['responseTimeTooFast'] })], '3');
    expect(unreliable.tags[1].value).toBe('scoreReports.unreliable');
    expect(unreliable.tags[1].tooltip).toContain('response time too fast');
  });

  it('includes the percentile breakdown row only for grade < 6', () => {
    const [underSix] = cards([makeTask()], '3');
    const namesUnder = underSix.scoresArray.map((row) => row[0]);
    expect(namesUnder).toContain('scoreReports.percentileScore');

    const [overSix] = cards([makeTask()], '8');
    const namesOver = overSix.scoresArray.map((row) => row[0]);
    expect(namesOver).not.toContain('scoreReports.percentileScore');
  });

  it('formats phonics subscores onto the displayed score as correct/attempted strings', () => {
    const task = makeTask({
      taskSlug: 'phonics',
      subscores: { cvc: { correct: 15, attempted: 19, percentCorrect: 78.9 } },
    });
    const [card] = cards([task], '3');
    expect(card.percentileScore.subscores).toEqual({ cvc: '15/19' });
  });

  it('adds a PA skills-to-work-on row from the backend skillsToWorkOn', () => {
    const task = makeTask({ taskSlug: 'pa', skillsToWorkOn: ['FSM'] });
    const [card] = cards([task], '3');
    const skillsRow = card.scoresArray.find((row) => row[0] === 'scoreReports.skillsToWorkOn');
    expect(skillsRow).toBeDefined();
  });

  it('excludes vocab/cva and tasks without a raw score', () => {
    const result = cards(
      [
        makeTask({ taskSlug: 'swr' }),
        makeTask({ taskSlug: 'vocab' }),
        makeTask({ taskSlug: 'cva' }),
        makeTask({ taskSlug: 'sre', scores: { rawScore: null, percentile: null, standardScore: null } }),
      ],
      '3',
    );
    expect(result.map((c) => c.taskId)).toEqual(['swr']);
  });

  it('scoreValueTemplate appends % for phonics/letter and blanks a null value', () => {
    const { computedTaskData, scoreValueTemplate } = useReportCardData({
      reportTasks: [makeTask({ taskSlug: 'phonics', scores: { rawScore: 10, percentile: 80, standardScore: null } })],
      studentGrade: '3',
      taskScoringVersions: {},
      t,
    });
    const [phonics] = computedTaskData.value;
    expect(scoreValueTemplate.value(phonics)).toBe('80%');

    const nullPercentile = { ...phonics, percentileScore: { ...phonics.percentileScore, value: null } };
    expect(scoreValueTemplate.value(nullPercentile)).toBe('');
  });
});
