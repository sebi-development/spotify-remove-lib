import { describe, expect, it } from 'vitest';
import { percentOf } from './progress.ts';

describe('percentOf', () => {
  it.each([
    [0, 85, 0],
    [1, 3, 33],
    [2, 3, 66],
    [40, 85, 47],
    [50, 200, 25],
    [1, 1000, 0],
    [999, 1000, 99],
  ])('%i of %i is %i%%', (removed, total, expected) => {
    expect(percentOf(removed, total)).toBe(expected);
  });

  it('is 100 when everything is removed', () => {
    expect(percentOf(33, 33)).toBe(100);
  });

  it('an empty category is already finished (0 of 0 is 100, not NaN)', () => {
    expect(percentOf(0, 0)).toBe(100);
  });

  it('never goes above 100', () => {
    expect(percentOf(10, 5)).toBe(100);
  });
});
