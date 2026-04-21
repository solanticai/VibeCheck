import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { startWebhookServer, buildOpenApiSpec } from '../../adapters/http-webhook/adapter.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { info } from '../ui/log.js';

export async function webhookServeCommand(options?: {
  port?: number;
  host?: string;
}): Promise<void> {
  const projectRoot = process.cwd();
  const port = options?.port ?? 7321;
  const host = options?.host ?? '127.0.0.1';

  printBanner('Webhook', `Starting VGuard webhook server on ${host}:${port}`);

  const server = await startWebhookServer({ projectRoot, port, host });
  info(
    `  ${color.green('Listening')} on ${color.bold(`http://${host}:${port}`)} — POST /hook/:event`,
  );
  info(`  ${color.dim('Health check: /healthz')}`);
  info(`  ${color.dim('Press Ctrl+C to stop.')}`);

  process.on('SIGINT', () => {
    info('\n  Shutting down webhook server...');
    server.close(() => {
      process.exit(0);
    });
  });
  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

export async function webhookSpecCommand(options?: { output?: string }): Promise<void> {
  const projectRoot = process.cwd();
  const outputPath = options?.output ?? join(projectRoot, '.vguard/webhook/openapi.json');
  const spec = buildOpenApiSpec();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, spec, 'utf-8');
  info(`  OpenAPI spec written to ${color.bold(outputPath)}`);
}
