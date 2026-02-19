import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react auto-cleanup requires global afterEach;
// Vitest doesn't provide it without `globals: true`, so register explicitly.
afterEach(() => {
  cleanup();
});

// Radix UI components (Checkbox) use ResizeObserver, which jsdom doesn't provide
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
