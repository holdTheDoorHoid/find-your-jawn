import { describe, expect, it } from 'vitest';
import { formatDate, formatMonthYear, lastSeenActive, monthKey, monthsSince, parseDateParts } from './dates';

describe('dates', () => {
  it('formats a month and year', () => {
    expect(formatMonthYear('2026-09')).toBe('September 2026');
    expect(formatMonthYear('2026-01-31')).toBe('January 2026');
    expect(formatMonthYear('2026-12-01T00:00:00Z')).toBe('December 2026');
  });

  it('does not let a time zone move the month', () => {
    // 2026-10-01 at midnight UTC is still September 30 in Philadelphia. We never convert.
    expect(formatMonthYear('2026-10-01T00:00:00Z')).toBe('October 2026');
    expect(formatDate('2026-10-01')).toBe('October 1, 2026');
  });

  it('formats a full date', () => {
    expect(formatDate('2026-10-04')).toBe('October 4, 2026');
    expect(formatDate('2026-10')).toBe('October 2026');
  });

  it('writes the last seen active line', () => {
    expect(lastSeenActive('2026-09')).toBe('Last seen active: September 2026');
  });

  it('returns null for missing or unreadable input', () => {
    expect(formatMonthYear(undefined)).toBeNull();
    expect(formatMonthYear('')).toBeNull();
    expect(formatMonthYear('last spring')).toBeNull();
    expect(formatMonthYear('2026-13')).toBeNull();
    expect(lastSeenActive(null)).toBeNull();
    expect(parseDateParts('2026-02-45')).toBeNull();
  });

  it('counts months and makes sortable keys', () => {
    expect(monthsSince('2025-10', new Date('2026-10-08T12:00:00Z'))).toBe(12);
    expect(monthsSince('bad', new Date())).toBeNull();
    expect(monthKey('2026-09')).toBeGreaterThan(monthKey('2025-12'));
    expect(monthKey(undefined)).toBe(0);
  });
});
