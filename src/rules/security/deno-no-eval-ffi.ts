import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

export const denoNoEvalFfi: Rule = {
  id: 'security/deno-no-eval-ffi',
  name: 'Deno No eval / FFI',
  description: 'Blocks Deno FFI (Deno.dlopen) usage and eval() within Deno source.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context): RuleResult => {
    const ruleId = 'security/deno-no-eval-ffi';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };
    if (!['ts', 'js', 'mjs'].includes(getExtension(filePath))) return { status: 'pass', ruleId };
    if (/\bDeno\.dlopen\s*\(/.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'Deno.dlopen FFI call — loads arbitrary native code.',
        fix: 'Use a JS/TS implementation, or sandbox FFI use behind a heavily reviewed wrapper module.',
      };
    }
    if (/\beval\s*\(/.test(content) && !/^\s*\/\//.test(content)) {
      return {
        status: 'block',
        ruleId,
        message: 'eval() inside Deno code.',
        fix: 'Replace with explicit logic. eval gets all permissions of the caller.',
      };
    }
    return { status: 'pass', ruleId };
  },
};
