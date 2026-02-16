import { describe, it, expect } from 'vitest';
import {
  MAX_CHANNELS_PER_USER,
  DEFAULT_MAX_LISTS,
  DEDUP_TTL_HOURS,
} from '../src/index.ts';

describe('Shared constants', () => {
  it('MAX_CHANNELS_PER_USER is 30', () => {
    expect(MAX_CHANNELS_PER_USER).toBe(30);
  });

  it('DEFAULT_MAX_LISTS is 1', () => {
    expect(DEFAULT_MAX_LISTS).toBe(1);
  });

  it('DEDUP_TTL_HOURS is 72', () => {
    expect(DEDUP_TTL_HOURS).toBe(72);
  });
});
