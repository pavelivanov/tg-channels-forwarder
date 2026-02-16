import { createServer, type Server } from 'node:http';
import type { Logger } from 'pino';

export function startHealthServer(port: number, logger: Logger): Server {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });

  server.listen(port, () => {
    logger.info({ port }, 'Health server listening');
  });

  return server;
}
