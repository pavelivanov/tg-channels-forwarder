import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type pino from 'pino';
import type { ForwardJob } from '@aggregator/shared';
import { AlbumGrouper } from '../src/listener/album-grouper.ts';

function createMockLogger(): pino.Logger {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => logger),
  } as unknown as pino.Logger;
  return logger;
}

function createJob(overrides: Partial<ForwardJob> = {}): ForwardJob {
  return {
    messageId: 1,
    sourceChannelId: 100,
    mediaType: 'photo',
    mediaFileId: 'photo:1:1',
    mediaGroupId: 'album-1',
    timestamp: 1700000000,
    ...overrides,
  };
}

describe('AlbumGrouper', () => {
  let logger: pino.Logger;
  let onFlush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createMockLogger();
    onFlush = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collects messages within 300ms window into a single job', async () => {
    const grouper = new AlbumGrouper(onFlush, logger);

    grouper.addMessage(createJob({ messageId: 1, mediaGroupId: 'album-1' }));
    grouper.addMessage(createJob({ messageId: 2, mediaGroupId: 'album-1' }));
    grouper.addMessage(createJob({ messageId: 3, mediaGroupId: 'album-1' }));

    // Not flushed yet
    expect(onFlush).not.toHaveBeenCalled();

    // Advance past the 300ms timer
    await vi.advanceTimersByTimeAsync(300);

    expect(onFlush).toHaveBeenCalledOnce();
    const flushedJob: ForwardJob = onFlush.mock.calls[0][0];
    expect(flushedJob.mediaGroup).toHaveLength(3);
    expect(flushedJob.mediaGroupId).toBe('album-1');
  });

  it('emits job after 300ms timeout from last message', async () => {
    const grouper = new AlbumGrouper(onFlush, logger);

    grouper.addMessage(createJob({ messageId: 1, mediaGroupId: 'album-1' }));

    // Advance 200ms — not yet
    await vi.advanceTimersByTimeAsync(200);
    expect(onFlush).not.toHaveBeenCalled();

    // Add another message, resets timer
    grouper.addMessage(createJob({ messageId: 2, mediaGroupId: 'album-1' }));

    // Advance 200ms from second message — timer hasn't fired yet (300ms from second message)
    await vi.advanceTimersByTimeAsync(200);
    expect(onFlush).not.toHaveBeenCalled();

    // Advance remaining 100ms — now 300ms after second message
    await vi.advanceTimersByTimeAsync(100);
    expect(onFlush).toHaveBeenCalledOnce();
    const flushedJob: ForwardJob = onFlush.mock.calls[0][0];
    expect(flushedJob.mediaGroup).toHaveLength(2);
  });

  it('separate albums produce separate jobs', async () => {
    const grouper = new AlbumGrouper(onFlush, logger);

    grouper.addMessage(createJob({ messageId: 1, mediaGroupId: 'album-A' }));
    grouper.addMessage(createJob({ messageId: 2, mediaGroupId: 'album-B' }));
    grouper.addMessage(createJob({ messageId: 3, mediaGroupId: 'album-A' }));

    await vi.advanceTimersByTimeAsync(300);

    expect(onFlush).toHaveBeenCalledTimes(2);

    const flushedA = onFlush.mock.calls.find(
      (c: ForwardJob[]) => c[0].mediaGroupId === 'album-A',
    );
    const flushedB = onFlush.mock.calls.find(
      (c: ForwardJob[]) => c[0].mediaGroupId === 'album-B',
    );
    expect(flushedA![0].mediaGroup).toHaveLength(2);
    expect(flushedB![0].mediaGroup).toHaveLength(1);
  });

  it('max 10 messages triggers immediate flush', async () => {
    const grouper = new AlbumGrouper(onFlush, logger);

    for (let i = 1; i <= 10; i++) {
      grouper.addMessage(createJob({ messageId: i, mediaGroupId: 'album-1' }));
    }

    // Should flush immediately without waiting for timer
    expect(onFlush).toHaveBeenCalledOnce();
    const flushedJob: ForwardJob = onFlush.mock.calls[0][0];
    expect(flushedJob.mediaGroup).toHaveLength(10);
  });

  it('clear() cancels pending timers', async () => {
    const grouper = new AlbumGrouper(onFlush, logger);

    grouper.addMessage(createJob({ messageId: 1, mediaGroupId: 'album-1' }));
    grouper.addMessage(createJob({ messageId: 2, mediaGroupId: 'album-2' }));

    grouper.clear();

    await vi.advanceTimersByTimeAsync(300);

    expect(onFlush).not.toHaveBeenCalled();
  });

  it('uses first message as base for combined job', async () => {
    const grouper = new AlbumGrouper(onFlush, logger);

    grouper.addMessage(createJob({
      messageId: 10,
      mediaGroupId: 'album-1',
      caption: 'First caption',
      mediaType: 'photo',
      mediaFileId: 'photo:10:10',
    }));
    grouper.addMessage(createJob({
      messageId: 11,
      mediaGroupId: 'album-1',
      mediaType: 'photo',
      mediaFileId: 'photo:11:11',
    }));

    await vi.advanceTimersByTimeAsync(300);

    const flushedJob: ForwardJob = onFlush.mock.calls[0][0];
    expect(flushedJob.messageId).toBe(10);
    expect(flushedJob.caption).toBe('First caption');
    expect(flushedJob.mediaGroup![0].messageId).toBe(10);
    expect(flushedJob.mediaGroup![1].messageId).toBe(11);
  });
});
