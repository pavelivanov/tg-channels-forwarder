import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Api } from 'grammy';
import type pino from 'pino';
import type { ForwardJob, TelegramEntity } from '@aggregator/shared';
import { MessageSender } from '../src/forwarder/message-sender.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockApi() {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendPhoto: vi.fn().mockResolvedValue(undefined),
    sendVideo: vi.fn().mockResolvedValue(undefined),
    sendDocument: vi.fn().mockResolvedValue(undefined),
    sendAnimation: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn().mockResolvedValue(undefined),
    sendMediaGroup: vi.fn().mockResolvedValue(undefined),
  };
}

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
    timestamp: 1700000000,
    ...overrides,
  };
}

const CHAT_ID = -1001234567890;

const sampleEntities: TelegramEntity[] = [
  { type: 'bold', offset: 0, length: 5 },
  { type: 'text_link', offset: 6, length: 4, url: 'https://example.com' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageSender', () => {
  let api: ReturnType<typeof createMockApi>;
  let logger: pino.Logger;
  let sender: MessageSender;

  beforeEach(() => {
    api = createMockApi();
    logger = createMockLogger();
    sender = new MessageSender(api as unknown as Api, logger);
  });

  // -------------------------------------------------------------------------
  // T004 — individual send methods
  // -------------------------------------------------------------------------

  describe('sendText', () => {
    it('calls api.sendMessage with text and entities', async () => {
      await sender.sendText(CHAT_ID, 'Hello world', sampleEntities);

      expect(api.sendMessage).toHaveBeenCalledOnce();
      expect(api.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        'Hello world',
        { entities: sampleEntities },
      );
    });

    it('calls api.sendMessage without entities when omitted', async () => {
      await sender.sendText(CHAT_ID, 'Plain text');

      expect(api.sendMessage).toHaveBeenCalledOnce();
      expect(api.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        'Plain text',
        { entities: undefined },
      );
    });
  });

  describe('sendPhoto', () => {
    it('calls api.sendPhoto with fileId, caption, and entities', async () => {
      await sender.sendPhoto(CHAT_ID, 'photo-file-id', 'Nice pic', sampleEntities);

      expect(api.sendPhoto).toHaveBeenCalledOnce();
      expect(api.sendPhoto).toHaveBeenCalledWith(
        CHAT_ID,
        'photo-file-id',
        { caption: 'Nice pic', caption_entities: sampleEntities },
      );
    });

    it('calls api.sendPhoto without caption when omitted', async () => {
      await sender.sendPhoto(CHAT_ID, 'photo-file-id');

      expect(api.sendPhoto).toHaveBeenCalledOnce();
      expect(api.sendPhoto).toHaveBeenCalledWith(
        CHAT_ID,
        'photo-file-id',
        { caption: undefined, caption_entities: undefined },
      );
    });
  });

  describe('sendVideo', () => {
    it('calls api.sendVideo with fileId, caption, and entities', async () => {
      await sender.sendVideo(CHAT_ID, 'video-file-id', 'Great video', sampleEntities);

      expect(api.sendVideo).toHaveBeenCalledOnce();
      expect(api.sendVideo).toHaveBeenCalledWith(
        CHAT_ID,
        'video-file-id',
        { caption: 'Great video', caption_entities: sampleEntities },
      );
    });
  });

  describe('sendDocument', () => {
    it('calls api.sendDocument with fileId, caption, and entities', async () => {
      await sender.sendDocument(CHAT_ID, 'doc-file-id', 'Read this', sampleEntities);

      expect(api.sendDocument).toHaveBeenCalledOnce();
      expect(api.sendDocument).toHaveBeenCalledWith(
        CHAT_ID,
        'doc-file-id',
        { caption: 'Read this', caption_entities: sampleEntities },
      );
    });
  });

  describe('sendAnimation', () => {
    it('calls api.sendAnimation with fileId, caption, and entities', async () => {
      await sender.sendAnimation(CHAT_ID, 'gif-file-id', 'Funny gif', sampleEntities);

      expect(api.sendAnimation).toHaveBeenCalledOnce();
      expect(api.sendAnimation).toHaveBeenCalledWith(
        CHAT_ID,
        'gif-file-id',
        { caption: 'Funny gif', caption_entities: sampleEntities },
      );
    });
  });

  describe('sendAudio', () => {
    it('calls api.sendAudio with fileId, caption, and entities', async () => {
      await sender.sendAudio(CHAT_ID, 'audio-file-id', 'Listen up', sampleEntities);

      expect(api.sendAudio).toHaveBeenCalledOnce();
      expect(api.sendAudio).toHaveBeenCalledWith(
        CHAT_ID,
        'audio-file-id',
        { caption: 'Listen up', caption_entities: sampleEntities },
      );
    });
  });

  // -------------------------------------------------------------------------
  // T004 — send() dispatch
  // -------------------------------------------------------------------------

  describe('send() dispatch', () => {
    it('dispatches to sendText for text-only job', async () => {
      const job = createJob({
        text: 'Hello from channel',
        entities: sampleEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendMessage).toHaveBeenCalledOnce();
      expect(api.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        'Hello from channel',
        { entities: sampleEntities },
      );
    });

    it('dispatches to sendPhoto for photo job', async () => {
      const job = createJob({
        mediaType: 'photo',
        mediaFileId: 'photo:1:2',
        caption: 'Photo caption',
        captionEntities: sampleEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendPhoto).toHaveBeenCalledOnce();
      expect(api.sendPhoto).toHaveBeenCalledWith(
        CHAT_ID,
        'photo:1:2',
        { caption: 'Photo caption', caption_entities: sampleEntities },
      );
    });

    it('dispatches to sendVideo for video job', async () => {
      const job = createJob({
        mediaType: 'video',
        mediaFileId: 'doc:3:4',
        caption: 'Video caption',
        captionEntities: sampleEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendVideo).toHaveBeenCalledOnce();
      expect(api.sendVideo).toHaveBeenCalledWith(
        CHAT_ID,
        'doc:3:4',
        { caption: 'Video caption', caption_entities: sampleEntities },
      );
    });

    it('dispatches to sendDocument for document job', async () => {
      const job = createJob({
        mediaType: 'document',
        mediaFileId: 'doc:5:6',
        caption: 'Doc caption',
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendDocument).toHaveBeenCalledOnce();
      expect(api.sendDocument).toHaveBeenCalledWith(
        CHAT_ID,
        'doc:5:6',
        { caption: 'Doc caption', caption_entities: undefined },
      );
    });

    it('dispatches to sendAnimation for animation job', async () => {
      const job = createJob({
        mediaType: 'animation',
        mediaFileId: 'doc:7:8',
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendAnimation).toHaveBeenCalledOnce();
      expect(api.sendAnimation).toHaveBeenCalledWith(
        CHAT_ID,
        'doc:7:8',
        { caption: undefined, caption_entities: undefined },
      );
    });

    it('dispatches to sendAudio for audio job', async () => {
      const job = createJob({
        mediaType: 'audio',
        mediaFileId: 'doc:9:10',
        caption: 'Audio caption',
        captionEntities: sampleEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendAudio).toHaveBeenCalledOnce();
      expect(api.sendAudio).toHaveBeenCalledWith(
        CHAT_ID,
        'doc:9:10',
        { caption: 'Audio caption', caption_entities: sampleEntities },
      );
    });

    it('dispatches to sendAlbum when mediaGroup is present', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'photo', mediaFileId: 'photo:1:1', caption: 'Album caption', captionEntities: sampleEntities }),
        createJob({ messageId: 2, mediaType: 'photo', mediaFileId: 'photo:2:2' }),
        createJob({ messageId: 3, mediaType: 'photo', mediaFileId: 'photo:3:3' }),
      ];
      const job = createJob({
        mediaGroup,
        mediaGroupId: 'album-1',
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendMediaGroup).toHaveBeenCalledOnce();
      // Individual send methods should NOT have been called
      expect(api.sendMessage).not.toHaveBeenCalled();
      expect(api.sendPhoto).not.toHaveBeenCalled();
    });

    it('prefers mediaGroup over mediaType when both are present', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'photo', mediaFileId: 'photo:1:1' }),
        createJob({ messageId: 2, mediaType: 'photo', mediaFileId: 'photo:2:2' }),
      ];
      const job = createJob({
        mediaType: 'photo',
        mediaFileId: 'photo:1:1',
        mediaGroup,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendMediaGroup).toHaveBeenCalledOnce();
      expect(api.sendPhoto).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // T014 — US2: media caption and entity validation
  // -------------------------------------------------------------------------

  describe('T014: media messages include caption and entities', () => {
    it('photo message forwards caption and captionEntities', async () => {
      const captionEntities: TelegramEntity[] = [
        { type: 'italic', offset: 0, length: 7 },
      ];
      const job = createJob({
        mediaType: 'photo',
        mediaFileId: 'photo:100:200',
        caption: 'Caption with formatting',
        captionEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendPhoto).toHaveBeenCalledWith(
        CHAT_ID,
        'photo:100:200',
        { caption: 'Caption with formatting', caption_entities: captionEntities },
      );
    });

    it('video message forwards caption and captionEntities', async () => {
      const captionEntities: TelegramEntity[] = [
        { type: 'bold', offset: 0, length: 3 },
        { type: 'url', offset: 4, length: 20 },
      ];
      const job = createJob({
        mediaType: 'video',
        mediaFileId: 'doc:300:400',
        caption: 'Vid https://example.com',
        captionEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendVideo).toHaveBeenCalledWith(
        CHAT_ID,
        'doc:300:400',
        { caption: 'Vid https://example.com', caption_entities: captionEntities },
      );
    });

    it('document message forwards caption and captionEntities', async () => {
      const captionEntities: TelegramEntity[] = [
        { type: 'code', offset: 0, length: 10 },
      ];
      const job = createJob({
        mediaType: 'document',
        mediaFileId: 'doc:500:600',
        caption: 'console.log()',
        captionEntities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendDocument).toHaveBeenCalledWith(
        CHAT_ID,
        'doc:500:600',
        { caption: 'console.log()', caption_entities: captionEntities },
      );
    });

    it('media message without caption passes undefined', async () => {
      const job = createJob({
        mediaType: 'photo',
        mediaFileId: 'photo:700:800',
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendPhoto).toHaveBeenCalledWith(
        CHAT_ID,
        'photo:700:800',
        { caption: undefined, caption_entities: undefined },
      );
    });

    it('text message forwards entities (not captionEntities)', async () => {
      const entities: TelegramEntity[] = [
        { type: 'mention', offset: 0, length: 8 },
      ];
      const job = createJob({
        text: '@channel hello',
        entities,
      });

      await sender.send(CHAT_ID, job);

      expect(api.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        '@channel hello',
        { entities },
      );
    });
  });

  // -------------------------------------------------------------------------
  // T015 — US3: album via sendMediaGroup
  // -------------------------------------------------------------------------

  describe('T015: sendAlbum via sendMediaGroup', () => {
    it('sends album with correct chatId and InputMedia array', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 10, mediaType: 'photo', mediaFileId: 'photo:10:10', caption: 'Album caption', captionEntities: sampleEntities }),
        createJob({ messageId: 11, mediaType: 'photo', mediaFileId: 'photo:11:11' }),
        createJob({ messageId: 12, mediaType: 'video', mediaFileId: 'video:12:12' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      expect(api.sendMediaGroup).toHaveBeenCalledOnce();

      const [calledChatId, calledMedia] = api.sendMediaGroup.mock.calls[0];
      expect(calledChatId).toBe(CHAT_ID);
      expect(calledMedia).toHaveLength(3);
    });

    it('only first item in album carries the caption', async () => {
      const captionEntities: TelegramEntity[] = [
        { type: 'bold', offset: 0, length: 5 },
      ];
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'photo', mediaFileId: 'photo:1:1', caption: 'First caption', captionEntities }),
        createJob({ messageId: 2, mediaType: 'photo', mediaFileId: 'photo:2:2', caption: 'Ignored caption' }),
        createJob({ messageId: 3, mediaType: 'photo', mediaFileId: 'photo:3:3' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      const [, calledMedia] = api.sendMediaGroup.mock.calls[0];

      // First item should have the caption and entities
      expect(calledMedia[0].caption).toBe('First caption');
      expect(calledMedia[0].caption_entities).toEqual(captionEntities);

      // Subsequent items should NOT have caption
      expect(calledMedia[1].caption).toBeUndefined();
      expect(calledMedia[1].caption_entities).toBeUndefined();
      expect(calledMedia[2].caption).toBeUndefined();
      expect(calledMedia[2].caption_entities).toBeUndefined();
    });

    it('maps photo items to InputMedia photo type', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'photo', mediaFileId: 'photo:1:1' }),
        createJob({ messageId: 2, mediaType: 'photo', mediaFileId: 'photo:2:2' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      const [, calledMedia] = api.sendMediaGroup.mock.calls[0];
      expect(calledMedia[0].type).toBe('photo');
      expect(calledMedia[0].media).toBe('photo:1:1');
      expect(calledMedia[1].type).toBe('photo');
      expect(calledMedia[1].media).toBe('photo:2:2');
    });

    it('maps video items to InputMedia video type', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'video', mediaFileId: 'video:1:1' }),
        createJob({ messageId: 2, mediaType: 'video', mediaFileId: 'video:2:2' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      const [, calledMedia] = api.sendMediaGroup.mock.calls[0];
      expect(calledMedia[0].type).toBe('video');
      expect(calledMedia[0].media).toBe('video:1:1');
      expect(calledMedia[1].type).toBe('video');
      expect(calledMedia[1].media).toBe('video:2:2');
    });

    it('maps document items to InputMedia document type', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'document', mediaFileId: 'doc:1:1', caption: 'Doc album' }),
        createJob({ messageId: 2, mediaType: 'document', mediaFileId: 'doc:2:2' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      const [, calledMedia] = api.sendMediaGroup.mock.calls[0];
      expect(calledMedia[0].type).toBe('document');
      expect(calledMedia[0].media).toBe('doc:1:1');
      expect(calledMedia[0].caption).toBe('Doc album');
      expect(calledMedia[1].type).toBe('document');
      expect(calledMedia[1].caption).toBeUndefined();
    });

    it('handles mixed photo and video album', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'photo', mediaFileId: 'photo:1:1', caption: 'Mixed album' }),
        createJob({ messageId: 2, mediaType: 'video', mediaFileId: 'video:2:2' }),
        createJob({ messageId: 3, mediaType: 'photo', mediaFileId: 'photo:3:3' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      const [, calledMedia] = api.sendMediaGroup.mock.calls[0];
      expect(calledMedia).toHaveLength(3);
      expect(calledMedia[0].type).toBe('photo');
      expect(calledMedia[0].caption).toBe('Mixed album');
      expect(calledMedia[1].type).toBe('video');
      expect(calledMedia[1].caption).toBeUndefined();
      expect(calledMedia[2].type).toBe('photo');
      expect(calledMedia[2].caption).toBeUndefined();
    });

    it('handles single-item album', async () => {
      const mediaGroup: ForwardJob[] = [
        createJob({ messageId: 1, mediaType: 'photo', mediaFileId: 'photo:1:1', caption: 'Solo' }),
      ];

      await sender.sendAlbum(CHAT_ID, mediaGroup);

      expect(api.sendMediaGroup).toHaveBeenCalledOnce();
      const [, calledMedia] = api.sendMediaGroup.mock.calls[0];
      expect(calledMedia).toHaveLength(1);
      expect(calledMedia[0].caption).toBe('Solo');
    });
  });
});
