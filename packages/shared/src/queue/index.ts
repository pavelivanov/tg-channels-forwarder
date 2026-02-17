export interface ForwardJob {
  messageId: number;
  sourceChannelId: number;
  text?: string;
  caption?: string;
  mediaType?: string;
  mediaFileId?: string;
  mediaGroupId?: string;
  mediaGroup?: ForwardJob[];
  timestamp: number;
}

export const QUEUE_NAME_FORWARD = 'message-forward';
export const QUEUE_NAME_FORWARD_DLQ = 'message-forward-dlq';
export const QUEUE_MAX_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 5000;
export const QUEUE_KEEP_COMPLETED = 1000;
export const QUEUE_KEEP_FAILED = 5000;
