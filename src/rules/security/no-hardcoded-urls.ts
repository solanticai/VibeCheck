import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const configSchema = z.object({
  allowDomains: z.array(z.string()).optional(),
  allowInTestFiles: z.boolean().optional(),
});

/**
 * security/no-hardcoded-urls
 *
 * Warns when code contains hardcoded localhost, 127.0.0.1, or raw URLs in
 * fetch/axios calls that should use environment variables. AI agents routinely
 * hardcode URLs causing deployment failures.
 */
export const noHardcodedUrls: Rule = {
  id: 'security/no-hardcoded-urls',
  name: 'No Hardcoded URLs',
  description:
    'Warns about hardcoded localhost and API URLs that should use environment variables.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'security/no-hardcoded-urls';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rb'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    // Skip test and fixture files
    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const allowInTestFiles = (ruleConfig?.options?.allowInTestFiles as boolean) ?? true;
    if (allowInTestFiles && /\.(test|spec|e2e|fixture|mock)\.[tj]sx?$/.test(filePath)) {
      return { status: 'pass', ruleId };
    }

    // Skip config, env, and constant files
    const filename = filePath.split(/[/\\]/).pop()?.toLowerCase() ?? '';
    if (/^(\.env|config|constants|fixtures|seeds|\.example)/.test(filename)) {
      return { status: 'pass', ruleId };
    }

    const allowDomains = (ruleConfig?.options?.allowDomains as string[]) ?? [];

    // Check for localhost / 127.0.0.1
    const localhostPattern = /['"`]https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/;
    if (localhostPattern.test(content)) {
      return {
        status: 'warn',
        ruleId,
        message: 'Hardcoded localhost URL detected — this will fail in production.',
        fix: 'Use an environment variable: process.env.API_URL or similar.',
      };
    }

    // Check for hardcoded URLs in fetch/axios/http calls
    const fetchUrlPattern =
      /(?:fetch|axios\.(?:get|post|put|patch|delete)|http\.(?:get|post|put|patch|delete)|got\.(?:get|post|put|patch|delete)|request)\s*\(\s*['"`](https?:\/\/[^'"`\s]+)/g;

    let match;
    while ((match = fetchUrlPattern.exec(content)) !== null) {
      const url = match[1];

      // Check if domain is in allowlist
      const isAllowed = allowDomains.some((domain) => url.includes(domain));
      if (isAllowed) continue;

      return {
        status: 'warn',
        ruleId,
        message: `Hardcoded URL in API call: "${url.slice(0, 60)}..." — use an environment variable.`,
        fix: 'Extract the base URL to an environment variable: process.env.API_BASE_URL',
      };
    }

    return { status: 'pass', ruleId };
  },
};
