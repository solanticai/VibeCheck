import type { Rule, RuleResult, VGuardPlugin } from '../../../src/types.js';
import { readRuleHits } from '../../../src/engine/tracker.js';

const PLUGIN_STATE: { lastNotifiedAt: number; sending: boolean } = {
  lastNotifiedAt: 0,
  sending: false,
};

const SEVERITY_RANK: Record<string, number> = { info: 0, warn: 1, block: 2 };

interface SlackPayload {
  text: string;
  channel?: string;
}

async function postToSlack(webhookUrl: string, payload: SlackPayload): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildMessage(
  hits: ReadonlyArray<{ ruleId: string; status: string; filePath?: string; timestamp: string }>,
  includeFilePath: boolean,
): string {
  const lines = [`*VGuard: ${hits.length} block${hits.length === 1 ? '' : 's'} recorded*`];
  for (const h of hits.slice(0, 10)) {
    const when = new Date(h.timestamp).toLocaleString();
    const where = includeFilePath && h.filePath ? ` \`${h.filePath}\`` : '';
    lines.push(`• \`${h.ruleId}\`${where} — ${when}`);
  }
  if (hits.length > 10) lines.push(`_(+${hits.length - 10} more)_`);
  return lines.join('\n');
}

const blockEventsRule: Rule = {
  id: 'slack-notify/block-events',
  name: 'Slack: block events',
  description: 'Forwards rule-block events to a configured Slack Incoming Webhook (rate-limited).',
  severity: 'info',
  events: ['PostToolUse', 'Stop'],
  editCheck: false,

  check: async (context): Promise<RuleResult> => {
    const ruleId = 'slack-notify/block-events';

    try {
      const repoRoot = context.gitContext.repoRoot;
      if (!repoRoot) return { status: 'pass', ruleId };

      const cfg = context.projectConfig.rules.get(ruleId);
      const webhookUrl = cfg?.options?.webhookUrl as string | undefined;
      if (!webhookUrl) return { status: 'pass', ruleId };

      const minSeverity = (cfg?.options?.minSeverity as string) ?? 'block';
      const minRank = SEVERITY_RANK[minSeverity] ?? 2;
      const rateLimitMs = (cfg?.options?.rateLimitMs as number) ?? 60_000;
      const channel = cfg?.options?.channel as string | undefined;
      const includeFilePath = (cfg?.options?.includeFilePath as boolean) ?? true;

      if (PLUGIN_STATE.sending) return { status: 'pass', ruleId };
      if (Date.now() - PLUGIN_STATE.lastNotifiedAt < rateLimitMs) {
        return { status: 'pass', ruleId };
      }

      const hits = readRuleHits(repoRoot).filter((h) => {
        const rank = SEVERITY_RANK[h.status] ?? 0;
        if (rank < minRank) return false;
        return new Date(h.timestamp).getTime() > PLUGIN_STATE.lastNotifiedAt;
      });

      if (hits.length === 0) return { status: 'pass', ruleId };

      PLUGIN_STATE.sending = true;
      try {
        const message = buildMessage(hits, includeFilePath);
        await postToSlack(webhookUrl, { text: message, channel });
      } finally {
        PLUGIN_STATE.sending = false;
        PLUGIN_STATE.lastNotifiedAt = Date.now();
      }

      return { status: 'pass', ruleId };
    } catch {
      return { status: 'pass', ruleId };
    }
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-slack-notify',
  version: '0.1.0',
  rules: [blockEventsRule],
};

export default plugin;
export { plugin, blockEventsRule, buildMessage };
