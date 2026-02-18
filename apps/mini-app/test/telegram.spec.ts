import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('telegram helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('when in Telegram environment', () => {
    beforeEach(() => {
      vi.doMock('@twa-dev/sdk', () => ({
        default: {
          initData: 'mock-init-data-string',
          ready: vi.fn(),
          expand: vi.fn(),
          BackButton: {
            show: vi.fn(),
            hide: vi.fn(),
            onClick: vi.fn(),
            offClick: vi.fn(),
          },
        },
      }));
    });

    it('getTelegramInitData returns initData string', async () => {
      const { getTelegramInitData } = await import('../src/lib/telegram');
      expect(getTelegramInitData()).toBe('mock-init-data-string');
    });

    it('isTelegramEnvironment returns true', async () => {
      const { isTelegramEnvironment } = await import('../src/lib/telegram');
      expect(isTelegramEnvironment()).toBe(true);
    });

    it('telegramReady calls WebApp.ready() and WebApp.expand()', async () => {
      const WebApp = (await import('@twa-dev/sdk')).default;
      const { telegramReady } = await import('../src/lib/telegram');
      telegramReady();
      expect(WebApp.ready).toHaveBeenCalled();
      expect(WebApp.expand).toHaveBeenCalled();
    });
  });

  describe('when outside Telegram environment', () => {
    beforeEach(() => {
      vi.doMock('@twa-dev/sdk', () => ({
        default: {
          initData: '',
          ready: vi.fn(),
          expand: vi.fn(),
          BackButton: {
            show: vi.fn(),
            hide: vi.fn(),
            onClick: vi.fn(),
            offClick: vi.fn(),
          },
        },
      }));
    });

    it('getTelegramInitData returns undefined when initData is empty', async () => {
      const { getTelegramInitData } = await import('../src/lib/telegram');
      expect(getTelegramInitData()).toBeUndefined();
    });

    it('isTelegramEnvironment returns false when initData is empty', async () => {
      const { isTelegramEnvironment } = await import('../src/lib/telegram');
      expect(isTelegramEnvironment()).toBe(false);
    });
  });
});
