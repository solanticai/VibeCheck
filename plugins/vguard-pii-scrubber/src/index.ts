import type { Rule, RuleResult, VGuardPlugin, Preset } from '../../../src/types.js';

const PII_PATTERNS: Array<[string, RegExp]> = [
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  ['phone-us', /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/],
  ['credit-card', /\b(?:\d[ -]*){13,19}\b/],
  ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/],
];

function luhnValid(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i] ?? '0', 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function scan(content: string): Array<{ type: string; match: string }> {
  const hits: Array<{ type: string; match: string }> = [];
  for (const [type, re] of PII_PATTERNS) {
    const m = content.match(re);
    if (!m) continue;
    if (type === 'credit-card' && !luhnValid(m[0])) continue;
    hits.push({ type, match: m[0] });
  }
  return hits;
}

function isMemoryFile(filePath: string): boolean {
  const p = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    /\.claude\/memory\//.test(p) ||
    /\.cursor\/rules\//.test(p) ||
    /\bclaude\.md$/.test(p) ||
    /\bagents\.md$/.test(p)
  );
}

const noPiiInMemory: Rule = {
  id: 'pii/no-pii-in-memory',
  name: 'No PII in Memory Files',
  description:
    'Blocks writes to agent memory/context files that contain PII (email, phone, SSN, credit card, IP).',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'pii/no-pii-in-memory';
    const filePath = (context.toolInput.file_path as string) ?? '';
    const content =
      (context.toolInput.content as string) ?? (context.toolInput.new_string as string) ?? '';
    if (!filePath || !content) return { status: 'pass', ruleId };
    if (!isMemoryFile(filePath)) return { status: 'pass', ruleId };

    const hits = scan(content);
    if (hits.length === 0) return { status: 'pass', ruleId };

    return {
      status: 'block',
      ruleId,
      message: `PII detected in memory file: ${hits.map((h) => h.type).join(', ')}.`,
      fix: 'Redact PII (mask characters, use placeholders like `<USER_EMAIL>`) before writing to agent memory.',
      metadata: { types: hits.map((h) => h.type) },
    };
  },
};

const piiGdpr: Preset = {
  id: 'pii-gdpr',
  name: 'PII / GDPR',
  description: 'Prevents PII from leaking into agent memory or commit messages.',
  version: '0.1.0',
  rules: {
    'pii/no-pii-in-memory': true,
  },
};

const plugin: VGuardPlugin = {
  name: '@anthril/vguard-pii-scrubber',
  version: '0.1.0',
  rules: [noPiiInMemory],
  presets: [piiGdpr],
};

export default plugin;
export { plugin, noPiiInMemory, piiGdpr, scan as scanForPii, luhnValid };
