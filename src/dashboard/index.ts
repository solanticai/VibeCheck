import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { watch, existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRuleHits } from '../engine/tracker.js';
import { aggregateReport } from '../report/aggregator.js';

/**
 * Dashboard HTML is shipped as a sibling file `index.html` so editors
 * apply HTML/CSS/JS syntax highlighting to it. Loaded once at startup
 * (cheap: ~3 KB, cached by the Node module loader).
 */
function loadDashboardHtml(): string {
  // __dirname equivalent in ESM + CJS-compatible fallback
  const here =
    typeof import.meta !== 'undefined' && import.meta.url
      ? dirname(fileURLToPath(import.meta.url))
      : __dirname;
  const path = join(here, 'index.html');
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return (
      '<!doctype html><html><body><p>dashboard asset missing at ' + path + '</p></body></html>'
    );
  }
}

const INDEX_HTML = loadDashboardHtml();

export interface DashboardOptions {
  projectRoot: string;
  port?: number;
  host?: string;
}

function statsFromRoot(projectRoot: string): {
  totalHits: number;
  blocks: number;
  warns: number;
  passes: number;
} {
  try {
    const data = aggregateReport(projectRoot);
    return {
      totalHits: data.totalHits,
      blocks: data.blockWarnRatio.blocks,
      warns: data.blockWarnRatio.warns,
      passes: data.blockWarnRatio.passes,
    };
  } catch {
    return { totalHits: 0, blocks: 0, warns: 0, passes: 0 };
  }
}

export function startDashboardServer(options: DashboardOptions): Promise<Server> {
  const port = options.port ?? 7322;
  const host = options.host ?? '127.0.0.1';
  const projectRoot = options.projectRoot;
  const tracker = join(projectRoot, '.vguard/data/rule-hits.jsonl');

  const clients = new Set<ServerResponse>();

  function pushEvent(res: ServerResponse, event: string, data: unknown): void {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // ignore
    }
  }

  function broadcastStats(): void {
    const stats = statsFromRoot(projectRoot);
    for (const r of clients) pushEvent(r, 'stats', stats);
  }

  let lastSize = 0;

  function tailRecentHits(): void {
    if (!existsSync(tracker)) return;
    try {
      const size = statSync(tracker).size;
      if (size <= lastSize) {
        lastSize = size;
        return;
      }
      const content = readFileSync(tracker, 'utf-8');
      const newText = content.slice(lastSize);
      lastSize = size;
      const lines = newText.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const rec = JSON.parse(line) as Record<string, unknown>;
          for (const r of clients) pushEvent(r, 'hit', rec);
        } catch {
          // ignore malformed line
        }
      }
      broadcastStats();
    } catch {
      // ignore
    }
  }

  // Initialize lastSize to end of existing file so we only stream new entries.
  try {
    if (existsSync(tracker)) lastSize = statSync(tracker).size;
  } catch {
    // ignore
  }

  if (existsSync(tracker)) {
    try {
      watch(tracker, { persistent: false }, () => tailRecentHits());
    } catch {
      // watch can fail on certain filesystems — fall through
    }
  }

  // Poll every 2 seconds as a fallback and also to pick up rotated files.
  const poller = setInterval(() => tailRecentHits(), 2000);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '';
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(INDEX_HTML);
      return;
    }
    if (url === '/stats') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(statsFromRoot(projectRoot)));
      return;
    }
    if (url === '/stream') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      clients.add(res);
      pushEvent(res, 'stats', statsFromRoot(projectRoot));
      // Also send the last 30 hits for immediate context.
      try {
        const recent = readRuleHits(projectRoot).slice(-30);
        for (const r of recent) pushEvent(res, 'hit', r);
      } catch {
        // ignore
      }
      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  server.on('close', () => clearInterval(poller));

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}
