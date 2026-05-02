import { describe, expect, it } from 'vitest';
import { formatEasyQuoteCode, normalizeEasyQuoteCodeInput, normalizeQuoteIdForLookup } from './quoteId';

describe('quote ID helpers', () => {
  it('normalizes lookup IDs while preserving legacy Q-dash IDs', () => {
    expect(normalizeQuoteIdForLookup(' abc 123 ')).toBe('ABC123');
    expect(normalizeQuoteIdForLookup(' q-abc12345 ')).toBe('Q-ABC12345');
  });

  it('normalizes six-character easy quote code input', () => {
    expect(normalizeEasyQuoteCodeInput('ab c-123-extra')).toBe('ABC123');
    expect(normalizeEasyQuoteCodeInput('8k7m2a')).toBe('8K7M2A');
  });

  it('formats easy codes in two groups of three', () => {
    expect(formatEasyQuoteCode('8k7')).toBe('8K7');
    expect(formatEasyQuoteCode('8k7m2a')).toBe('8K7 M2A');
  });
});
