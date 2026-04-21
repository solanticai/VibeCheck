import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const configSchema = z.object({
  allowInTestFiles: z.boolean().optional(),
});

/**
 * security/unsafe-eval
 *
 * Blocks usage of eval(), new Function(), and string-based setTimeout/setInterval
 * which create code injection vectors. AI agents frequently generate these for
 * dynamic operations when safer alternatives exist.
 */
export const unsafeEval: Rule = {
  id: 'security/unsafe-eval',
  name: 'Unsafe Eval',
  description: 'Blocks eval(), new Function(), and string-argument setTimeout/setInterval.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'security/unsafe-eval';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    // Skip .d.ts files
    if (filePath.endsWith('.d.ts')) return { status: 'pass', ruleId };

    // Python-specific checks: exec() / compile() with string source
    if (ext === 'py') {
      const pyLines = content.split('\n');
      for (const line of pyLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) continue;
        if (/\bexec\s*\(/.test(trimmed)) {
          return {
            status: 'block',
            ruleId,
            message: 'Python exec() detected — executes arbitrary code, high injection risk.',
            fix: 'Refactor to an explicit dispatch table or ast.literal_eval if you only need safe evaluation of a Python literal.',
          };
        }
        if (/\beval\s*\(/.test(trimmed)) {
          return {
            status: 'block',
            ruleId,
            message: 'Python eval() detected — executes arbitrary code.',
            fix: 'Use ast.literal_eval for safe literal evaluation, or a proper parser for your domain.',
          };
        }
        if (
          /\bcompile\s*\([^)]*,\s*['"][^'"]*['"]\s*,\s*['"](?:exec|eval|single)['"]/.test(trimmed)
        ) {
          return {
            status: 'block',
            ruleId,
            message:
              'Python compile(..., "exec"|"eval"|"single") detected — produces a runnable code object from string source.',
            fix: 'Avoid dynamic code compilation on untrusted input. Prefer a predefined set of named operations.',
          };
        }
      }
      return { status: 'pass', ruleId };
    }

    // Skip test files if configured
    const ruleConfig = context.projectConfig.rules.get(ruleId);
    const allowInTestFiles = (ruleConfig?.options?.allowInTestFiles as boolean) ?? false;
    if (allowInTestFiles && /\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) {
      return { status: 'pass', ruleId };
    }

    // Check line-by-line to skip comments
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip single-line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      // Check for eval()
      if (/\beval\s*\(/.test(trimmed)) {
        return {
          status: 'block',
          ruleId,
          message: 'eval() detected — creates a code injection vulnerability.',
          fix: 'Use JSON.parse() for data, or a safer alternative like a lookup table or switch statement.',
        };
      }

      // Check for new Function()
      if (/\bnew\s+Function\s*\(/.test(trimmed)) {
        return {
          status: 'block',
          ruleId,
          message: 'new Function() detected — equivalent to eval() and creates injection risk.',
          fix: 'Refactor to use direct function definitions or a lookup table.',
        };
      }

      // Check for setTimeout/setInterval with string first argument
      if (/\b(?:setTimeout|setInterval)\s*\(\s*['"`]/.test(trimmed)) {
        return {
          status: 'block',
          ruleId,
          message:
            'setTimeout/setInterval with string argument detected — this is implicitly evaluated as code.',
          fix: 'Pass a function reference instead: setTimeout(() => { ... }, delay)',
        };
      }
    }

    return { status: 'pass', ruleId };
  },
};
