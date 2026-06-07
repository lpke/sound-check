import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const certHost = process.env.PHONE_CERT_HOST ?? '192.168.20.18';
const port = Number(process.env.PHONE_CERT_PORT ?? process.argv[2] ?? 8000);
const rootCaFile = join(process.cwd(), 'certificates', 'rootCA.pem');

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PHONE_CERT_PORT value: ${port}`);
}

if (!existsSync(rootCaFile)) {
  throw new Error(
    'Missing certificates/rootCA.pem. Run `pnpm cert:phone` first.',
  );
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

  if (url.pathname !== '/' && url.pathname !== '/rootCA.pem') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Disposition': 'attachment; filename="rootCA.pem"',
    'Content-Type': 'application/x-pem-file',
  });
  createReadStream(rootCaFile).pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(
    `Serving iPhone root CA at http://${certHost}:${port}/rootCA.pem`,
  );
  console.log('Stop this server after the profile is installed.');
});
