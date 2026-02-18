import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Writable } from 'node:stream';
import { LOG_REDACT_PATHS } from '@aggregator/shared';

function createCapturingLogger(): { logger: pino.Logger; getOutput: () => string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = pino({ redact: LOG_REDACT_PATHS }, stream);
  return { logger, getOutput: () => lines };
}

describe('Pino redaction', () => {
  it('redacts sensitive fields from log output', () => {
    const { logger, getOutput } = createCapturingLogger();

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer my-secret-token',
          'x-api-key': 'api-key-12345',
        },
      },
      botToken: 'bot123:ABCdef',
      sessionString: 'long-session-string-value',
      config: {
        BOT_TOKEN: 'bot123:ABCdef',
        TELEGRAM_SESSION: 'telegram-session-value',
        JWT_SECRET: 'jwt-secret-value-here',
      },
    }, 'test log');

    const output = getOutput();
    expect(output.length).toBe(1);
    const parsed = JSON.parse(output[0]!) as Record<string, unknown>;

    // Verify sensitive values are redacted
    const logStr = JSON.stringify(parsed);
    expect(logStr).not.toContain('Bearer my-secret-token');
    expect(logStr).not.toContain('api-key-12345');
    expect(logStr).not.toContain('bot123:ABCdef');
    expect(logStr).not.toContain('long-session-string-value');
    expect(logStr).not.toContain('telegram-session-value');
    expect(logStr).not.toContain('jwt-secret-value-here');

    // Verify [Redacted] is present
    expect(logStr).toContain('[Redacted]');
  });
});
