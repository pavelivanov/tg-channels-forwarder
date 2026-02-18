export const MAX_CHANNELS_PER_USER = 30;
export const DEFAULT_MAX_LISTS = 1;
export const DEDUP_TTL_HOURS = 72;

export const ALBUM_GROUP_TIMEOUT_MS = 300;
export const ALBUM_MAX_SIZE = 10;
export const JOIN_RATE_LIMIT_PER_HOUR = 5;
export const JOIN_DELAY_MIN_MS = 2000;
export const JOIN_DELAY_MAX_MS = 5000;

export const FORWARD_GLOBAL_RATE_LIMIT = 20;
export const FORWARD_PER_DEST_RATE_LIMIT = 15;

export const QUEUE_NAME_CHANNEL_CLEANUP = 'channel-cleanup';
export const CLEANUP_GRACE_PERIOD_DAYS = 30;

export const HEALTH_CHECK_TIMEOUT_MS = 3000;

export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  '*.password',
  '*.token',
  '*.secret',
  'botToken',
  'sessionString',
  'config.BOT_TOKEN',
  'config.TELEGRAM_SESSION',
  'config.JWT_SECRET',
];
