export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: { id: number };
  language?: string;
  custom_emoji_id?: string;
}

export interface ForwardJob {
  messageId: number;
  sourceChannelId: number;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  captionEntities?: TelegramEntity[];
  mediaType?: string;
  mediaFileId?: string;
  mediaGroupId?: string;
  mediaGroup?: ForwardJob[];
  timestamp: number;
  correlationId?: string;
}

export const QUEUE_NAME_FORWARD = 'message-forward';
export const QUEUE_NAME_FORWARD_DLQ = 'message-forward-dlq';
export const QUEUE_NAME_CHANNEL_OPS = 'channel-ops';
export const QUEUE_MAX_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 5000;
export const QUEUE_KEEP_COMPLETED = 1000;
export const QUEUE_KEEP_FAILED = 5000;

export interface ChannelOpsJob {
  operation: 'join' | 'leave';
  channelId: string;
  username?: string;
  telegramId?: number;
}
