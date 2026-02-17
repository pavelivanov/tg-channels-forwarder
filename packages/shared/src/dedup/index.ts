import { createHash } from 'node:crypto';

export function normalizeText(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === '') return '';

  return normalized.split(' ').slice(0, 10).join(' ');
}

export function computeHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
