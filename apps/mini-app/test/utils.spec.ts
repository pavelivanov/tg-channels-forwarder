import { describe, it, expect } from 'vitest';
import { cn } from '../src/lib/utils';

describe('cn()', () => {
  it('merges multiple class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('filters out falsy values', () => {
    expect(cn('base', false && 'hidden')).toBe('base');
    expect(cn('base', undefined, null, '')).toBe('base');
  });

  it('handles conditional classes via clsx syntax', () => {
    expect(cn('base', { hidden: true })).toBe('base hidden');
    expect(cn('base', { hidden: false })).toBe('base');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('resolves conflicting color classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
