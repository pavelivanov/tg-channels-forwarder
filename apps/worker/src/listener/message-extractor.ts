import { Api } from 'telegram';
import type { ForwardJob, TelegramEntity } from '@aggregator/shared';

export function extractForwardJob(message: Api.Message): ForwardJob {
  const mediaType = getMediaType(message);
  const hasMedia = mediaType !== undefined;

  const entities = convertEntities(message.entities);

  return {
    messageId: message.id,
    sourceChannelId: getChannelId(message),
    text: hasMedia ? undefined : (message.message || undefined),
    caption: hasMedia ? (message.message || undefined) : undefined,
    entities: hasMedia ? undefined : entities,
    captionEntities: hasMedia ? entities : undefined,
    mediaType,
    mediaFileId: getMediaFileId(message),
    mediaGroupId: message.groupedId?.toString(),
    timestamp: message.date,
  };
}

const ENTITY_CLASS_TO_TYPE: Record<string, string> = {
  MessageEntityBold: 'bold',
  MessageEntityItalic: 'italic',
  MessageEntityUnderline: 'underline',
  MessageEntityStrike: 'strikethrough',
  MessageEntityCode: 'code',
  MessageEntityPre: 'pre',
  MessageEntityBlockquote: 'blockquote',
  MessageEntityMention: 'mention',
  MessageEntityHashtag: 'hashtag',
  MessageEntityCashtag: 'cashtag',
  MessageEntityBotCommand: 'bot_command',
  MessageEntityUrl: 'url',
  MessageEntityTextUrl: 'text_link',
  MessageEntityEmail: 'email',
  MessageEntityPhone: 'phone_number',
  MessageEntityMentionName: 'text_mention',
  MessageEntityCustomEmoji: 'custom_emoji',
  MessageEntitySpoiler: 'spoiler',
};

export function convertEntities(
  entities: Api.TypeMessageEntity[] | undefined,
): TelegramEntity[] | undefined {
  if (!entities || entities.length === 0) return undefined;

  return entities
    .map((e): TelegramEntity | undefined => {
      const type = ENTITY_CLASS_TO_TYPE[e.className];
      if (!type) return undefined;

      const result: TelegramEntity = { type, offset: e.offset, length: e.length };

      if ('url' in e && typeof e.url === 'string') result.url = e.url;
      if ('language' in e && typeof e.language === 'string') result.language = e.language;
      if ('userId' in e && e.userId != null) result.user = { id: Number(e.userId) };
      if ('documentId' in e && e.documentId != null)
        result.custom_emoji_id = String(e.documentId);

      return result;
    })
    .filter((e): e is TelegramEntity => e !== undefined);
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
