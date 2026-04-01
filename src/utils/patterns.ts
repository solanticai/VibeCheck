/**
 * Check if content contains a "use client" directive in the first few lines.
 * React/Next.js requires this directive at the very top of the file.
 */
export function hasUseClientDirective(content: string): boolean {
  const firstFiveLines = content.split('\n').slice(0, 5).join('\n');
  return /["']use client["']/.test(firstFiveLines);
}

/**
 * Check if content contains imports from "src/" paths (should use aliases like @/).
 */
export function hasSrcImport(content: string): boolean {
  return /from\s+["']src\//.test(content);
}

/**
 * Check if content contains deep relative imports (4+ levels of ../).
 */
export function hasDeepRelativeImport(content: string): boolean {
  return /from\s+["'](\.\.\/){4,}/.test(content);
}

/**
 * Check if content uses deprecated cacheTime (React Query v4 → gcTime in v5).
 */
export function hasDeprecatedCacheTime(content: string): boolean {
  return /\bcacheTime\b/.test(content);
}

/**
 * Common high-entropy secret patterns.
 * Each entry: [name, regex, description]
 */
export const SECRET_PATTERNS: Array<[string, RegExp, string]> = [
  // AWS
  ['AWS Access Key', /AKIA[0-9A-Z]{16}/, 'AWS access key ID'],
  [
    'AWS Secret Key',
    /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}/,
    'AWS secret access key',
  ],

  // GitHub
  ['GitHub Token', /gh[ps]_[A-Za-z0-9_]{36,}/, 'GitHub personal access token'],
  [
    'GitHub Fine-Grained',
    /github_pat_[A-Za-z0-9_]{82,}/,
    'GitHub fine-grained personal access token',
  ],

  // Generic API keys
  [
    'Generic API Key',
    /(?:api[_-]?key|apikey)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/,
    'Generic API key',
  ],
  [
    'Generic Secret',
    /(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/,
    'Generic secret or password',
  ],

  // Bearer tokens
  ['Bearer Token', /Bearer\s+[A-Za-z0-9\-._~+/]+=*/, 'Bearer authentication token'],

  // Private keys
  ['Private Key', /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, 'Private key'],

  // Stripe
  ['Stripe Key', /sk_(?:live|test)_[A-Za-z0-9]{24,}/, 'Stripe secret key'],

  // Slack
  ['Slack Token', /xox[bpras]-[A-Za-z0-9-]{10,}/, 'Slack API token'],

  // npm
  ['npm Token', /npm_[A-Za-z0-9]{36}/, 'npm authentication token'],
];

/**
 * Dangerous bash command patterns that should be blocked.
 * Each entry: [name, regex, description]
 */
export const DANGEROUS_COMMAND_PATTERNS: Array<[string, RegExp, string]> = [
  [
    'rm -rf /',
    /rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/(?!\w)/,
    'Recursive force delete from root',
  ],
  ['rm -rf ~', /rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+~/, 'Recursive force delete home directory'],
  [
    'git push --force',
    /git\s+push\s+.*(?:--force(?!-with-lease)|-f\b)/,
    'Force push (use --force-with-lease instead)',
  ],
  ['git reset --hard', /git\s+reset\s+--hard/, 'Hard reset (destroys uncommitted changes)'],
  [
    'git clean -fd',
    /git\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d/,
    'Force clean untracked files and directories',
  ],
  ['pipe to shell', /curl\s+.*\|\s*(?:ba)?sh/, 'Piping remote content to shell'],
  ['wget pipe to shell', /wget\s+.*\|\s*(?:ba)?sh/, 'Piping downloaded content to shell'],
  ['chmod 777', /chmod\s+777/, 'Setting world-writable permissions'],
  ['dd of=/dev', /dd\s+.*of=\/dev\//, 'Writing directly to device'],
  [':(){:|:&};:', /:\(\)\s*\{.*\|.*&\s*\}\s*;\s*:/, 'Fork bomb'],
];

/**
 * Dangerous SQL patterns for migration safety.
 * Each entry: [name, regex, description]
 */
export const DANGEROUS_SQL_PATTERNS: Array<[string, RegExp, string]> = [
  ['DROP TABLE without IF EXISTS', /DROP\s+TABLE\s+(?!IF\s+EXISTS)/i, 'Use DROP TABLE IF EXISTS'],
  [
    'DROP COLUMN without IF EXISTS',
    /DROP\s+COLUMN\s+(?!IF\s+EXISTS)/i,
    'Use DROP COLUMN IF EXISTS',
  ],
  ['TRUNCATE TABLE', /TRUNCATE\s+TABLE/i, 'TRUNCATE deletes all data without logging'],
  [
    'DELETE without WHERE',
    /DELETE\s+FROM\s+\w+\s*;/i,
    'DELETE without WHERE clause deletes all rows',
  ],
  [
    'UPDATE without WHERE',
    /UPDATE\s+\w+\s+SET\s+[^;]+(?<!\s+WHERE\s+[^;]+);/i,
    'UPDATE without WHERE clause affects all rows',
  ],
  [
    'DROP CONSTRAINT without IF EXISTS',
    /ALTER\s+TABLE\s+\w+\s+DROP\s+CONSTRAINT\s+(?!IF\s+EXISTS)/i,
    'Use DROP CONSTRAINT IF EXISTS',
  ],
];
