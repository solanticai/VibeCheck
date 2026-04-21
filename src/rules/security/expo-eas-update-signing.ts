import type { Rule, RuleResult } from '../../types.js';
import { getExtension, normalizePath } from '../../utils/path.js';

export const expoEasUpdateSigning: Rule = {
  id: 'security/expo-eas-update-signing',
  name: 'Expo EAS Update Signing',
  description: 'Warns when eas.json has updates configured without codeSigningCertificate.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write', 'Edit'] },
  check: (context): RuleResult => {
    const ruleId = 'security/expo-eas-update-signing';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (getExtension(filePath) !== 'json') return { status: 'pass', ruleId };
    if (!/\beas\.json$/.test(normalizePath(filePath))) return { status: 'pass', ruleId };
    if (!/"updates"\s*:/.test(content)) return { status: 'pass', ruleId };
    if (/codeSigningCertificate/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'eas.json configures updates without codeSigningCertificate.',
      fix: 'Sign EAS Updates to prevent silent swap of the update bundle in transit.',
    };
  },
};
