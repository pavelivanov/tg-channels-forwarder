import pino from 'pino';
import { loadConfig } from './config.ts';
import { startHealthServer } from './health.ts';

const config = loadConfig();

const logger = pino({
  transport:
    config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

logger.info({ env: config.NODE_ENV }, 'Worker starting');

startHealthServer(config.WORKER_HEALTH_PORT, logger);

logger.info('Worker started successfully');
