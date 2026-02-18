export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceCheck {
  status: 'up' | 'down';
  latencyMs: number;
}

export interface ConnectionCheck {
  status: 'connected' | 'disconnected';
}

export interface QueueCheck {
  active: number;
  waiting: number;
  failed: number;
  dlq: number;
}

export interface HealthResponse {
  status: HealthStatus;
  uptime: number;
  checks: Record<string, ServiceCheck | ConnectionCheck | QueueCheck>;
}

export { computeHealthStatus } from './health-utils.ts';
export type { HealthChecks } from './health-utils.ts';
