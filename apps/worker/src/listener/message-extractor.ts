import { Api } from 'telegram';
import type { ForwardJob } from '@aggregator/shared';

export function extractForwardJob(message: Api.Message): ForwardJob {
  const mediaType = getMediaType(message);
  const hasMedia = mediaType !== undefined;

  return {
    messageId: message.id,
    sourceChannelId: getChannelId(message),
    text: hasMedia ? undefined : (message.message || undefined),
    caption: hasMedia ? (message.message || undefined) : undefined,
    mediaType,
    mediaFileId: getMediaFileId(message),
    mediaGroupId: message.groupedId?.toString(),
    timestamp: message.date,
  };
}

export function getChannelId(message: Api.Message): number {
  const peer = message.peerId as Api.PeerChannel;
  return Number(peer.channelId);
}

export function getMediaType(message: Api.Message): string | undefined {
  if (message.photo) return 'photo';
  if (message.gif) return 'animation';
  if (message.sticker) return 'sticker';
  if (message.voice) return 'voice';
  if (message.videoNote) return 'video_note';
  if (message.audio) return 'audio';
  if (message.video) return 'video';
  if (message.document) return 'document';
  return undefined;
}

export function getMediaFileId(message: Api.Message): string | undefined {
  if (message.photo && message.photo instanceof Api.Photo) {
    return `photo:${message.photo.id}:${message.photo.accessHash}`;
  }

  const doc =
    message.video ??
    message.document ??
    message.gif ??
    message.audio ??
    message.sticker ??
    message.voice ??
    message.videoNote;

  if (doc && doc instanceof Api.Document) {
    return `document:${doc.id}:${doc.accessHash}`;
  }

  return undefined;
}
