import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const expoNoPlainSecureStore: Rule = {
  id: 'security/expo-no-plain-secure-store',
  name: 'Expo No Plain SecureStore',
  description:
    'Warns when Expo SecureStore.setItemAsync is used without keychainAccessible option.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/expo-no-plain-secure-store';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'tsx', 'js', 'jsx'].includes(getExtension(filePath)))
      return { status: 'pass', ruleId };
    if (!/SecureStore\.setItemAsync\s*\(/.test(content)) return { status: 'pass', ruleId };
    if (/keychainAccessible\s*:/.test(content)) return { status: 'pass', ruleId };
    return {
      status: 'warn',
      ruleId,
      message: 'SecureStore.setItemAsync without keychainAccessible — uses default accessibility.',
      fix: 'Pass { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } to match sensitive-item accessibility.',
    };
  },
};
