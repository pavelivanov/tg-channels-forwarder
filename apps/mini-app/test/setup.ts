import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

vi.mock('@twa-dev/sdk', () => ({
  default: {
    initData: 'mock-init-data-string',
    initDataUnsafe: {
      user: {
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      },
    },
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#2678b6',
      button_color: '#2678b6',
      button_text_color: '#ffffff',
      secondary_bg_color: '#f0f0f0',
    },
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
      isVisible: false,
    },
    MainButton: {
      show: vi.fn(),
      hide: vi.fn(),
      setText: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
      isVisible: false,
      isActive: true,
    },
    showConfirm: vi.fn(),
  },
}));
