import { describe, it, expect } from 'vitest';
import {
  WORDS,
  hash,
  pickName,
  dayName,
  weekName,
  monthName,
  releaseNames,
  currentLabelDate,
} from '../tgcloud/lib/codename.js';

const dates = (from, count) =>
  Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10));

describe('lib/codename.js WORDS pool', () => {
  it('has at least 220 words, all /^[a-z]{4,}$/, no duplicates', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(220);
    for (const w of WORDS) {
      expect(w).toMatch(/^[a-z]{4,}$/);
    }
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});

describe('lib/codename.js pickName/hash', () => {
  it('is deterministic for the same seed', () => {
    expect(pickName('D:2026-10-20', [3, 2, 3])).toBe(pickName('D:2026-10-20', [3, 2, 3]));
    expect(hash('W:2026-W43')).toBe(hash('W:2026-W43'));
  });

  it('glues prefixes of distinct words: lengths drive the output length', () => {
    expect(pickName('x', [3, 2, 3])).toMatch(/^[a-z]{8}$/);
    expect(pickName('x', [3, 3, 2, 3])).toMatch(/^[a-z]{11}$/);
  });
});

describe('lib/codename.js names', () => {
  it('day/week/month have lengths 8/11/13 and the right case', () => {
    const { day, week, month } = releaseNames('2026-10-20');
    expect(day).toMatch(/^[a-z]{8}$/);
    expect(week).toMatch(/^[A-Z][a-z]{10}$/);
    expect(month).toMatch(/^[A-Z]{13}$/);
    expect(day).toBe(dayName('2026-10-20'));
    expect(week).toBe(weekName('2026-10-20'));
    expect(month).toBe(monthName('2026-10-20'));
  });

  it('day names differ for at least 25 of 30 consecutive dates', () => {
    const names = new Set(dates('2026-10-01', 30).map(dayName));
    expect(names.size).toBeGreaterThanOrEqual(25);
  });

  it('week name is stable across ISO week 2026-W43 and differs from neighbours', () => {
    const week = weekName('2026-10-19');
    for (const d of dates('2026-10-19', 7)) {
      expect(weekName(d)).toBe(week);
    }
    expect(weekName('2026-10-12')).not.toBe(week);
    expect(weekName('2026-10-26')).not.toBe(week);
  });

  it('month name is stable across 2026-10 and differs from November', () => {
    const month = monthName('2026-10-01');
    for (const d of dates('2026-10-01', 31)) {
      expect(monthName(d)).toBe(month);
    }
    expect(monthName('2026-11-01')).not.toBe(month);
  });

  it('handles the ISO-year boundary without crashing', () => {
    expect(weekName('2026-12-31')).toMatch(/^[A-Z][a-z]{10}$/);
    expect(weekName('2027-01-01')).toMatch(/^[A-Z][a-z]{10}$/);
  });

  it('puts 2024-12-30 into ISO week 2025-W01, same as 2025-01-03', () => {
    expect(weekName('2024-12-30')).toBe(weekName('2025-01-03'));
  });
});

describe('lib/codename.js currentLabelDate', () => {
  it.each([
    ['2026-10-20T15:59:59Z', '2026-10-20'],
    ['2026-10-20T16:00:00Z', '2026-10-21'],
    ['2026-12-31T20:00:00Z', '2027-01-01'],
  ])('at %s labels %s', (now, expected) => {
    expect(currentLabelDate(new Date(now))).toBe(expected);
  });
});
