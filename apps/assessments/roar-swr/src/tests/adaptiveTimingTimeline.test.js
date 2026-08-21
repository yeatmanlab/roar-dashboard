import { describe, expect, it, vi } from 'vitest';

vi.mock('@jspsych/plugin-call-function', () => ({
  default: 'jsPsychCallFunction',
}));

const { createAdaptiveTimingBreakEvents } = await import('../experiment/adaptiveTimingTimeline');

const expectedEnds = (numAdaptive) => {
  const blockCount = Math.floor(numAdaptive / 3);
  const blockCounts = [blockCount, blockCount, numAdaptive - 2 * blockCount];
  const ends = [];

  blockCounts.forEach((count, index) => {
    const start = blockCounts.slice(0, index).reduce((sum, value) => sum + value, 0);
    ends.push(start + Math.floor(count / 2));
    if (index < blockCounts.length - 1) ends.push(start + count);
  });
  ends.push(numAdaptive);

  return ends;
};

const blockCounts = (numAdaptive) => {
  const blockCount = Math.floor(numAdaptive / 3);
  return [blockCount, blockCount, numAdaptive - 2 * blockCount];
};

describe('createAdaptiveTimingBreakEvents', () => {
  it('produces the documented 84-trial schedule', () => {
    expect(createAdaptiveTimingBreakEvents(84)).toEqual([
      { endTrialNumTotal: 14, breakType: 'mid', breakIndex: 0 },
      { endTrialNumTotal: 28, breakType: 'post', breakIndex: 0 },
      { endTrialNumTotal: 42, breakType: 'mid', breakIndex: 1 },
      { endTrialNumTotal: 56, breakType: 'post', breakIndex: 1 },
      { endTrialNumTotal: 70, breakType: 'mid', breakIndex: 2 },
      { endTrialNumTotal: 84 },
    ]);
  });

  it.each([6, 30, 60, 84, 85, 100, 150])(
    'is monotonic, bounded, and block-summed for numAdaptive=%i',
    (numAdaptive) => {
      const events = createAdaptiveTimingBreakEvents(numAdaptive);
      const ends = events.map((event) => event.endTrialNumTotal);

      expect(ends).toEqual(expectedEnds(numAdaptive));
      expect(ends.every((end, index) => index === 0 || end > ends[index - 1])).toBe(true);
      expect(Math.max(...ends)).toBe(numAdaptive);
      expect(blockCounts(numAdaptive).reduce((sum, count) => sum + count, 0)).toBe(numAdaptive);

      expect(events[events.length - 1]).toEqual({ endTrialNumTotal: numAdaptive });
      expect(events.filter((event) => event.breakType === 'mid')).toHaveLength(3);
      expect(events.filter((event) => event.breakType === 'post')).toHaveLength(2);
    },
  );

  it('places remainder trials in the final block', () => {
    expect(createAdaptiveTimingBreakEvents(85).map((event) => event.endTrialNumTotal)).toEqual([
      14, 28, 42, 56, 70, 85,
    ]);
    expect(createAdaptiveTimingBreakEvents(100).map((event) => event.endTrialNumTotal)).toEqual([
      16, 33, 49, 66, 83, 100,
    ]);
  });

  it('uses valid break-event shapes before the run-end sentinel', () => {
    const events = createAdaptiveTimingBreakEvents(84);
    const breakEvents = events.slice(0, -1);

    breakEvents.forEach((event) => {
      expect(['mid', 'post']).toContain(event.breakType);
      expect(Number.isInteger(event.breakIndex)).toBe(true);
      expect(event.breakIndex).toBeGreaterThanOrEqual(0);
      expect(event.breakIndex).toBeLessThanOrEqual(2);
    });
  });

  it('maps break events to the intended mid and post pages', () => {
    const midBlockPageList = ['M0', 'M1', 'M2'];
    const postBlockPageList = ['P0', 'P1', 'P2'];

    const pages = createAdaptiveTimingBreakEvents(84).map((event) =>
      event.breakType === 'mid' ? midBlockPageList[event.breakIndex] : postBlockPageList[event.breakIndex],
    );

    expect(pages).toEqual(['M0', 'P0', 'M1', 'P1', 'M2', undefined]);
  });
});
