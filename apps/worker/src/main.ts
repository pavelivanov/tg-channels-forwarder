import pino from 'pino';
import { loadConfig } from './config.js';
import { startHealthServer } from './health.js';

const config = loadConfig();

const logger = pino({
  transport:
    config.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
});

logger.info({ env: config.NODE_ENV }, 'Worker starting');

startHealthServer(config.WORKER_HEALTH_PORT, logger);

logger.info('Worker started successfully');
