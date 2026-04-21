import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { loadConfig } from '../../config/loader.js';
import { resolveRules } from '../../engine/resolver.js';
import { runRules } from '../../engine/runner.js';
import { buildGitContext } from '../../utils/git.js';
import type { HookContext, HookEvent } from '../../types.js';

export interface WebhookServerOptions {
  /** Absolute path to the project whose config should be loaded. */
  projectRoot: string;
  /** Port to bind. Default: 7321. */
  port?: number;
  /** Bind host. Default: 127.0.0.1 (local-only). */
  host?: string;
}

const VALID_EVENTS: ReadonlySet<HookEvent> = new Set([
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'Notification',
  'PreCompact',
]);

function readJsonBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(text.length === 0 ? {} : JSON.parse(text));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

export async function startWebhookServer(options: WebhookServerOptions): Promise<Server> {
  const port = options.port ?? 7321;
  const host = options.host ?? '127.0.0.1';
  const projectRoot = options.projectRoot;

  const server = createServer((req, res) => {
    void handleRequest(req, res, projectRoot).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { allowed: true, reason: `internal: ${message}` });
    });
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  return server;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
): Promise<void> {
  const url = req.url ?? '';

  if (url === '/healthz' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  const m = url.match(/^\/hook\/([A-Za-z]+)$/);
  if (!m) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }

  const event = m[1] as HookEvent;
  if (!VALID_EVENTS.has(event)) {
    sendJson(res, 400, { error: `unknown event: ${event}` });
    return;
  }

  let body: {
    tool?: string;
    toolInput?: Record<string, unknown>;
    sessionId?: string;
    projectRoot?: string;
  };
  try {
    body = (await readJsonBody(req)) as typeof body;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'parse error';
    sendJson(res, 400, { error: msg });
    return;
  }

  const tool = body.tool ?? 'Unknown';
  const toolInput = body.toolInput ?? {};
  const effectiveRoot = body.projectRoot ?? projectRoot;

  const config = await loadConfig(effectiveRoot);
  if (!config) {
    // No config → fail-open (VGuard not installed / not initialised in this project).
    sendJson(res, 200, { allowed: true, reason: 'no-vguard-config' });
    return;
  }

  const resolved = resolveRules(event, tool, config);
  const gitContext = buildGitContext(effectiveRoot);
  const hookCtx: HookContext = {
    event,
    tool,
    toolInput,
    projectConfig: config,
    gitContext,
    sessionId: body.sessionId,
  };

  const result = await runRules(resolved, hookCtx);
  sendJson(res, 200, {
    allowed: !result.blocked,
    reason: result.blockingResult?.message ?? null,
    ruleId: result.blockingResult?.ruleId ?? null,
    warnings: result.warnings.map((w) => ({ ruleId: w.ruleId, message: w.message ?? '' })),
  });
}
