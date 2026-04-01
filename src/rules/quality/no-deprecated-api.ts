import { z } from 'zod';
import type { Rule, RuleResult } from '../../types.js';

const configSchema = z.object({
  patterns: z
    .array(
      z.object({
        pattern: z.string(),
        replacement: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

interface DeprecationPattern {
  pattern: RegExp;
  name: string;
  replacement: string;
  description: string;
}

const DEFAULT_DEPRECATIONS: DeprecationPattern[] = [
  {
    pattern: /\bcacheTime\b/,
    name: 'cacheTime',
    replacement: 'gcTime',
    description: 'React Query v5 renamed cacheTime to gcTime',
  },
  {
    pattern: /\bgetServerSideProps\b/,
    name: 'getServerSideProps',
    replacement: 'Server Components or Route Handlers',
    description: 'Next.js App Router uses Server Components instead of getServerSideProps',
  },
  {
    pattern: /\bgetStaticProps\b/,
    name: 'getStaticProps',
    replacement: 'Server Components with fetch()',
    description: 'Next.js App Router uses Server Components instead of getStaticProps',
  },
  {
    pattern: /\bgetStaticPaths\b/,
    name: 'getStaticPaths',
    replacement: 'generateStaticParams()',
    description: 'Next.js App Router uses generateStaticParams instead of getStaticPaths',
  },
  {
    pattern: /\bReact\.FC\b/,
    name: 'React.FC',
    replacement: 'explicit props type',
    description: 'React.FC is discouraged — use explicit props type annotation instead',
  },
];

/**
 * quality/no-deprecated-api
 *
 * Detects usage of deprecated APIs and suggests modern replacements.
 * Ships with React Query v5 and Next.js App Router patterns.
 * Configurable with custom deprecation patterns.
 */
export const noDeprecatedApi: Rule = {
  id: 'quality/no-deprecated-api',
  name: 'No Deprecated API',
  description: 'Detects deprecated API usage and suggests modern replacements.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  configSchema,

  check: (context): RuleResult => {
    const ruleId = 'quality/no-deprecated-api';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!content) return { status: 'pass', ruleId };

    // Only check TS/JS files
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (!['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) {
      return { status: 'pass', ruleId };
    }

    for (const dep of DEFAULT_DEPRECATIONS) {
      if (dep.pattern.test(content)) {
        return {
          status: 'block',
          ruleId,
          message: `Deprecated API "${dep.name}" detected. ${dep.description}.`,
          fix: `Replace "${dep.name}" with ${dep.replacement}.`,
          metadata: { deprecated: dep.name, replacement: dep.replacement },
        };
      }
    }

    return { status: 'pass', ruleId };
  },
};
