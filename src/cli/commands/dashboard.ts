import { startDashboardServer } from '../../dashboard/index.js';
import { printBanner } from '../ui/banner.js';
import { color } from '../ui/colors.js';
import { info } from '../ui/log.js';

export async function dashboardCommand(options?: { port?: number; host?: string }): Promise<void> {
  const projectRoot = process.cwd();
  const port = options?.port ?? 7322;
  const host = options?.host ?? '127.0.0.1';

  printBanner('Dashboard', 'Starting live VGuard dashboard');
  const server = await startDashboardServer({ projectRoot, port, host });
  info(`  ${color.green('Dashboard live')} at ${color.bold(`http://${host}:${port}`)}`);
  info(`  ${color.dim('Tailing .vguard/data/rule-hits.jsonl — Ctrl+C to stop.')}`);

  process.on('SIGINT', () => {
    info('\n  Stopping dashboard...');
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}
