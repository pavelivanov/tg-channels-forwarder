import type {
  HealthStatus,
  ServiceCheck,
  ConnectionCheck,
  QueueCheck,
} from './index.ts';

export interface HealthChecks {
  postgres?: ServiceCheck;
  redis?: ServiceCheck;
  userbot?: ConnectionCheck;
  bot?: ConnectionCheck;
  queue?: QueueCheck;
}

export function computeHealthStatus(checks: HealthChecks): HealthStatus {
  if (
    checks.postgres?.status === 'down' ||
    checks.redis?.status === 'down'
  ) {
    return 'unhealthy';
  }

  if (
    (checks.queue?.dlq ?? 0) > 0 ||
    checks.userbot?.status === 'disconnected'
  ) {
    return 'degraded';
  }

  return 'healthy';
}
