import { describe, expect, it } from 'vitest';
import { shouldCompleteFirstStage, shouldStopEarly, nextConsecutiveCorrect } from '../experiment/adaptiveTimingRules';

const adaptiveTiming = {
  transitionConsecutiveCorrect: 4,
  transitionThetaThres: -2,
  earlyStopNumItems: 30,
  earlyStopThetaThres: -5,
};

describe('adaptive timing transition rule', () => {
  it('completes when consecutive correct and theta are above threshold', () => {
    expect(shouldCompleteFirstStage(4, -1.9, adaptiveTiming)).toBe(true);
    expect(shouldCompleteFirstStage(5, 0, adaptiveTiming)).toBe(true);
  });

  it('keeps stage 1 when theta is at or below threshold', () => {
    expect(shouldCompleteFirstStage(4, -2, adaptiveTiming)).toBe(false);
    expect(shouldCompleteFirstStage(4, -2.1, adaptiveTiming)).toBe(false);
  });

  it('keeps stage 1 until enough consecutive correct responses are reached', () => {
    expect(shouldCompleteFirstStage(3, 5, adaptiveTiming)).toBe(false);
  });
});

describe('adaptive timing early-stop rule', () => {
  it('stops exactly at the configured item checkpoint when theta is below threshold', () => {
    expect(shouldStopEarly(30, -5.1, adaptiveTiming)).toBe(true);
  });

  it('does not stop when theta is at or above threshold', () => {
    expect(shouldStopEarly(30, -5, adaptiveTiming)).toBe(false);
    expect(shouldStopEarly(30, -4.9, adaptiveTiming)).toBe(false);
  });

  it('only stops at the configured item checkpoint', () => {
    expect(shouldStopEarly(29, -6, adaptiveTiming)).toBe(false);
    expect(shouldStopEarly(31, -6, adaptiveTiming)).toBe(false);
  });
});

describe('adaptive timing consecutive-correct counter', () => {
  it('increments on a correct response', () => {
    expect(nextConsecutiveCorrect(2, 1)).toBe(3);
  });

  it('resets on an incorrect response', () => {
    expect(nextConsecutiveCorrect(2, 0)).toBe(0);
  });

  it('treats missing previous values as zero', () => {
    expect(nextConsecutiveCorrect(undefined, 1)).toBe(1);
    expect(nextConsecutiveCorrect(null, 1)).toBe(1);
    expect(nextConsecutiveCorrect(undefined, 0)).toBe(0);
  });
});
