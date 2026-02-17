import { describe, it, expect } from 'vitest';
import { Api } from 'telegram';
import {
  extractForwardJob,
  getMediaType,
  getMediaFileId,
} from '../src/listener/message-extractor.ts';

function createMockMessage(overrides: Record<string, unknown> = {}): Api.Message {
  const base = {
    id: 42,
    peerId: new Api.PeerChannel({ channelId: BigInt(123456) }),
    message: '',
    date: 1700000000,
    media: undefined,
    groupedId: undefined,
    photo: undefined,
    video: undefined,
    document: undefined,
    gif: undefined,
    audio: undefined,
    sticker: undefined,
    voice: undefined,
    videoNote: undefined,
    ...overrides,
  };
  return base as unknown as Api.Message;
}

describe('extractForwardJob', () => {
  it('extracts text message correctly', () => {
    const msg = createMockMessage({ message: 'Hello world' });
    const job = extractForwardJob(msg);

    expect(job).toEqual({
      messageId: 42,
      sourceChannelId: 123456,
      text: 'Hello world',
      caption: undefined,
      mediaType: undefined,
      mediaFileId: undefined,
      mediaGroupId: undefined,
      timestamp: 1700000000,
    });
  });

  it('extracts photo message with caption', () => {
    const photo = new Api.Photo({
      id: BigInt(111),
      accessHash: BigInt(222),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      sizes: [],
    });
    const msg = createMockMessage({
      message: 'A nice photo',
      photo,
      media: new Api.MessageMediaPhoto({ photo }),
    });

    const job = extractForwardJob(msg);

    expect(job.messageId).toBe(42);
    expect(job.sourceChannelId).toBe(123456);
    expect(job.mediaType).toBe('photo');
    expect(job.mediaFileId).toBe('photo:111:222');
    expect(job.caption).toBe('A nice photo');
    expect(job.text).toBeUndefined();
  });

  it('extracts video message', () => {
    const doc = new Api.Document({
      id: BigInt(333),
      accessHash: BigInt(444),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      mimeType: 'video/mp4',
      size: BigInt(1000),
      attributes: [
        new Api.DocumentAttributeVideo({
          duration: 10,
          w: 1920,
          h: 1080,
        }),
      ],
    });
    const msg = createMockMessage({
      video: doc,
      media: new Api.MessageMediaDocument({ document: doc }),
    });

    const job = extractForwardJob(msg);

    expect(job.mediaType).toBe('video');
    expect(job.mediaFileId).toBe('document:333:444');
  });

  it('extracts document message', () => {
    const doc = new Api.Document({
      id: BigInt(555),
      accessHash: BigInt(666),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      mimeType: 'application/pdf',
      size: BigInt(5000),
      attributes: [
        new Api.DocumentAttributeFilename({ fileName: 'test.pdf' }),
      ],
    });
    const msg = createMockMessage({
      document: doc,
      media: new Api.MessageMediaDocument({ document: doc }),
    });

    const job = extractForwardJob(msg);

    expect(job.mediaType).toBe('document');
    expect(job.mediaFileId).toBe('document:555:666');
  });

  it('extracts animation (gif) message', () => {
    const doc = new Api.Document({
      id: BigInt(777),
      accessHash: BigInt(888),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      mimeType: 'video/mp4',
      size: BigInt(500),
      attributes: [
        new Api.DocumentAttributeAnimated(),
      ],
    });
    const msg = createMockMessage({
      gif: doc,
      media: new Api.MessageMediaDocument({ document: doc }),
    });

    const job = extractForwardJob(msg);

    expect(job.mediaType).toBe('animation');
    expect(job.mediaFileId).toBe('document:777:888');
  });

  it('extracts audio message', () => {
    const doc = new Api.Document({
      id: BigInt(901),
      accessHash: BigInt(902),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      mimeType: 'audio/mpeg',
      size: BigInt(3000),
      attributes: [
        new Api.DocumentAttributeAudio({ duration: 180 }),
      ],
    });
    const msg = createMockMessage({
      audio: doc,
      media: new Api.MessageMediaDocument({ document: doc }),
    });

    const job = extractForwardJob(msg);

    expect(job.mediaType).toBe('audio');
    expect(job.mediaFileId).toBe('document:901:902');
  });

  it('extracts grouped message with mediaGroupId', () => {
    const photo = new Api.Photo({
      id: BigInt(100),
      accessHash: BigInt(200),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      sizes: [],
    });
    const msg = createMockMessage({
      message: 'Album caption',
      photo,
      media: new Api.MessageMediaPhoto({ photo }),
      groupedId: BigInt(9999),
    });

    const job = extractForwardJob(msg);

    expect(job.mediaGroupId).toBe('9999');
    expect(job.mediaType).toBe('photo');
  });

  it('extracts channel ID from PeerChannel', () => {
    const msg = createMockMessage({
      peerId: new Api.PeerChannel({ channelId: BigInt(987654) }),
      message: 'test',
    });

    const job = extractForwardJob(msg);

    expect(job.sourceChannelId).toBe(987654);
  });
});

describe('getMediaType', () => {
  it('returns undefined for text-only message', () => {
    const msg = createMockMessage({ message: 'just text' });
    expect(getMediaType(msg)).toBeUndefined();
  });

  it('prioritizes gif over document', () => {
    const doc = new Api.Document({
      id: BigInt(1),
      accessHash: BigInt(2),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      mimeType: 'video/mp4',
      size: BigInt(100),
      attributes: [new Api.DocumentAttributeAnimated()],
    });
    const msg = createMockMessage({
      gif: doc,
      document: doc,
      media: new Api.MessageMediaDocument({ document: doc }),
    });

    expect(getMediaType(msg)).toBe('animation');
  });
});

describe('getMediaFileId', () => {
  it('returns undefined for no media', () => {
    const msg = createMockMessage({ message: 'text' });
    expect(getMediaFileId(msg)).toBeUndefined();
  });

  it('serializes photo file ID', () => {
    const photo = new Api.Photo({
      id: BigInt(10),
      accessHash: BigInt(20),
      fileReference: Buffer.alloc(0),
      date: 0,
      dcId: 1,
      sizes: [],
    });
    const msg = createMockMessage({
      photo,
      media: new Api.MessageMediaPhoto({ photo }),
    });

    expect(getMediaFileId(msg)).toBe('photo:10:20');
  });
});
