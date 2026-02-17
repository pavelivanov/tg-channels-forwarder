import { describe, it, expect } from 'vitest';
import { normalizeText, computeHash } from '../src/index.ts';

describe('normalizeText', () => {
  it('lowercases mixed case text', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  it('strips punctuation', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
  });

  it('handles short texts (< 10 words) without truncation', () => {
    expect(normalizeText('one two three')).toBe('one two three');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeText('')).toBe('');
  });

  it('preserves unicode characters (Cyrillic)', () => {
    expect(normalizeText('Привет мир!')).toBe('привет мир');
  });

  it('returns empty string for punctuation-only input', () => {
    expect(normalizeText('...!!!')).toBe('');
  });

  it('takes only first 10 words', () => {
    const input = 'one two three four five six seven eight nine ten eleven';
    expect(normalizeText(input)).toBe(
      'one two three four five six seven eight nine ten',
    );
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('handles mixed punctuation and spaces', () => {
    expect(normalizeText('HELLO   world!!!')).toBe('hello world');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeText('   ')).toBe('');
  });
});

describe('computeHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computeHash('hello world');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const hash1 = computeHash('hello world');
    const hash2 = computeHash('hello world');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeHash('hello world');
    const hash2 = computeHash('hello world!');
    expect(hash1).not.toBe(hash2);
  });
});
