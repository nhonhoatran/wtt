import { createServer, type Server } from 'node:http';

export interface WorkerHealthState {
  status: 'ok' | 'degraded';
  detail?: string;
}

/** Internal-only liveness endpoint for the container healthcheck; no public port is published. */
export function startWorkerHealthServer(port: number, getState: () => WorkerHealthState): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(getState()));
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}
