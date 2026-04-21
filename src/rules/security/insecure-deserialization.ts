import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const PATTERNS: Array<[RegExp, string]> = [
  // Python: pickle.load / pickle.loads
  [
    /\bpickle\.loads?\s*\(/,
    'pickle.load/loads — deserialising untrusted data allows arbitrary code execution.',
  ],
  // Python: yaml.load without SafeLoader
  [
    /\byaml\.load\s*\(\s*(?![^)]*Loader\s*=\s*(?:yaml\.)?SafeLoader)/,
    'yaml.load without SafeLoader — use yaml.safe_load.',
  ],
  // Node: node-serialize.unserialize
  [
    /\b(?:node-serialize|serialize-javascript)\.unserialize\s*\(/,
    'node-serialize.unserialize — known RCE sink.',
  ],
  // PHP: unserialize with user input
  [
    /\bunserialize\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE)\b/,
    'PHP unserialize() with user input — arbitrary object injection.',
  ],
];

/**
 * security/insecure-deserialization (CWE-502)
 *
 * Flags known deserialisation sinks (pickle, yaml.load, node-serialize,
 * PHP unserialize) that enable RCE when fed untrusted data. CSA 2026
 * measured a 3× increase in codebases adopting vibe coding.
 */
export const insecureDeserialization: Rule = {
  id: 'security/insecure-deserialization',
  name: 'Insecure Deserialization',
  description: 'Blocks use of known unsafe deserialisation sinks.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/insecure-deserialization';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['py', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'php'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    for (const [pattern, message] of PATTERNS) {
      if (pattern.test(content)) {
        return {
          status: 'block',
          ruleId,
          message,
          fix: 'Python: use json.loads for data, yaml.safe_load for YAML. Node: avoid node-serialize; use JSON.parse. PHP: avoid unserialize on user input; prefer json_decode.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
