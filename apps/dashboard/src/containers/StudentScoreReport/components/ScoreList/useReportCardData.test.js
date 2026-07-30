import { describe, it, expect, vi } from 'vitest';
import { useReportCardData } from './useReportCardData';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

// Mock the broken @bdelab/roar-utils package
vi.mock('@bdelab/roar-utils', () => ({
  getGrade: (grade) => {
    if (typeof grade === 'number') return grade;
    if (!grade) return 0;
    const gradeStr = String(grade).toLowerCase().trim();
    if (/^\d+$/.test(gradeStr)) return parseInt(gradeStr, 10);
    return 0;
  },
}));

// Mock getStudentGradeLevel to use the mocked getGrade
vi.mock('@/helpers/getStudentGradeLevel', () => ({
  getStudentGradeLevel: (grade) => {
    if (typeof grade === 'number') return grade;
    if (!grade) return 0;
    const gradeStr = String(grade).toLowerCase().trim();
    if (/^\d+$/.test(gradeStr)) return parseInt(gradeStr, 10);
    return 0;
  },
}));

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

  it('renders a colored dial for optional tasks (matching required tasks)', () => {
    const [card] = cards([makeTask({ optional: true })], '3');
    expect(card.percentileScore.supportColor).toBe(SCORE_SUPPORT_LEVEL_COLORS.ABOVE);
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

  it('includes all score rows (standard, percentile, raw) for all grades', () => {
    const [underSix] = cards([makeTask()], '3');
    const namesUnder = underSix.scoresArray.map((row) => row[0]);
    expect(namesUnder).toContain('scoreReports.standardScore');
    expect(namesUnder).toContain('scoreReports.percentileScore');
    expect(namesUnder).toContain('scoreReports.rawScore');

    const [overSix] = cards([makeTask()], '8');
    const namesOver = overSix.scoresArray.map((row) => row[0]);
    expect(namesOver).toContain('scoreReports.standardScore');
    expect(namesOver).toContain('scoreReports.percentileScore');
    expect(namesOver).toContain('scoreReports.rawScore');
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

  it('unnormed letter shows percentile score type for all grades', () => {
    const [card] = cards([makeTask({ taskSlug: 'letter' })], '3', {});
    expect(card.scoreToDisplay).toBe('percentileScore');

    const [cardGrade8] = cards([makeTask({ taskSlug: 'letter' })], '8', {});
    expect(cardGrade8.scoreToDisplay).toBe('percentileScore');
  });

  it('normed letter shows standard score type for grade >= 6', () => {
    const [card] = cards([makeTask({ taskSlug: 'letter' })], '8', { letter: 1 });
    expect(card.scoreToDisplay).toBe('standardScore');
  });

  it('normed SWR/SRE/PA show normed score types regardless of scoring version', () => {
    const [swr] = cards([makeTask({ taskSlug: 'swr' })], '3', {});
    expect(swr.scoreToDisplay).toBe('percentileScore'); // grade < 6

    const [sre] = cards([makeTask({ taskSlug: 'sre' })], '8', {});
    expect(sre.scoreToDisplay).toBe('standardScore'); // grade >= 6

    const [pa] = cards([makeTask({ taskSlug: 'pa' })], '5', {});
    expect(pa.scoreToDisplay).toBe('percentileScore'); // grade < 6
  });

  it('unnormed letter percentile max is 100, normed letter is 99', () => {
    const [unnormed] = cards([makeTask({ taskSlug: 'letter' })], '3', {});
    expect(unnormed.percentileScore.max).toBe(100);

    const [normed] = cards([makeTask({ taskSlug: 'letter' })], '3', { letter: 1 });
    expect(normed.percentileScore.max).toBe(99);
  });

  it('phonics and language variants always show 100 for percentile max', () => {
    const [phonics] = cards([makeTask({ taskSlug: 'phonics' })], '3', {});
    expect(phonics.percentileScore.max).toBe(100);

    const [letterEs] = cards([makeTask({ taskSlug: 'letter-es' })], '3', {});
    expect(letterEs.percentileScore.max).toBe(100);

    const [letterEnCa] = cards([makeTask({ taskSlug: 'letter-en-ca' })], '3', {});
    expect(letterEnCa.percentileScore.max).toBe(100);
  });
});
