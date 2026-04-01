import type { ZodType } from 'zod';

// ─── Hook Events ────────────────────────────────────────────────────────────

/** Hook events supported by Claude Code */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'PreCompact'
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'Notification';

// ─── Match Patterns ─────────────────────────────────────────────────────────

/** Pattern for matching tools and files */
export interface MatchPattern {
  /** Tool names to match (e.g., ["Edit", "Write"] or ["Bash"]) */
  tools?: string[];
  /** File glob patterns to include */
  include?: string[];
  /** File glob patterns to exclude */
  exclude?: string[];
}

// ─── Git Context ────────────────────────────────────────────────────────────

/** Git repository context available to rules */
export interface GitContext {
  /** Current branch name (null if not in a repo or detached HEAD) */
  branch: string | null;
  /** Whether the working tree has uncommitted changes */
  isDirty: boolean;
  /** Repository root path (absolute, forward slashes) */
  repoRoot: string | null;
  /** Number of commits ahead of upstream */
  unpushedCount: number;
  /** Whether the current branch tracks a remote */
  hasRemote: boolean;
}

// ─── Hook Context ───────────────────────────────────────────────────────────

/** Context passed to every rule check */
export interface HookContext {
  /** Which hook event triggered this check */
  event: HookEvent;
  /** Which tool is being used (Edit, Write, Bash, Read, etc.) */
  tool: string;
  /** Tool-specific input (file_path, content, command, old_string, new_string, etc.) */
  toolInput: Record<string, unknown>;
  /** Resolved project configuration */
  projectConfig: ResolvedConfig;
  /** Git repository context */
  gitContext: GitContext;
}

// ─── Rule Result ────────────────────────────────────────────────────────────

/** Machine-applicable autofix for a rule violation */
export interface Autofix {
  /** Replacement file content */
  newContent: string;
  /** Human-readable description of what the autofix does */
  description: string;
}

/** Result of a rule check */
export interface RuleResult {
  /** Whether the rule passed, wants to block, or wants to warn */
  status: 'pass' | 'block' | 'warn';
  /** Human-readable message explaining the result */
  message?: string;
  /** Suggested fix for the user */
  fix?: string;
  /** Machine-applicable autofix (optional, opt-in per rule) */
  autofix?: Autofix;
  /** Rule that produced this result */
  ruleId: string;
  /** Additional data for analytics/reporting */
  metadata?: Record<string, unknown>;
}

// ─── Rule ───────────────────────────────────────────────────────────────────

/** A single guardrail rule */
export interface Rule {
  /** Unique identifier: "category/rule-name" (e.g., "security/branch-protection") */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this rule prevents and why */
  description: string;
  /** Whether to block the operation or just warn */
  severity: 'block' | 'warn' | 'info';
  /** Which hook events trigger this rule */
  events: HookEvent[];
  /** Which tools and files this rule applies to */
  match?: MatchPattern;
  /** Zod schema for rule-specific configuration validation */
  configSchema?: ZodType;
  /** The actual check logic (can be async) */
  check: (context: HookContext) => Promise<RuleResult> | RuleResult;
  /** Whether to auto-generate an Edit variant via createEditVariant(). Default: true for Write rules */
  editCheck?: boolean;
}

// ─── Config Types ───────────────────────────────────────────────────────────

/** Supported AI agent types */
export type AgentType = 'claude-code' | 'cursor' | 'codex' | 'opencode';

/** Per-rule configuration */
export interface RuleConfig {
  /** Override severity for this rule */
  severity?: 'block' | 'warn' | 'info';
  /** Rule-specific options (validated by rule's configSchema) */
  [key: string]: unknown;
}

/** Convention learning settings */
export interface LearnConfig {
  /** Whether learning is enabled */
  enabled?: boolean;
  /** Paths to scan for conventions */
  scanPaths?: string[];
  /** Paths to ignore during scanning */
  ignorePaths?: string[];
}

/** User-facing config (vibecheck.config.ts) */
export interface VibeCheckConfig {
  /** Severity profile: strict, standard, relaxed, or audit */
  profile?: 'strict' | 'standard' | 'relaxed' | 'audit';
  /** Preset names to apply (e.g., ["nextjs-15", "typescript-strict"]) */
  presets?: string[];
  /** AI agents to generate adapters for (default: ["claude-code"]) */
  agents?: AgentType[];
  /** Rule configurations (enable, disable, or customize) */
  rules?: Record<string, RuleConfig | boolean>;
  /** Plugin package names */
  plugins?: string[];
  /** Convention learning settings */
  learn?: LearnConfig;
  /** Cloud sync settings */
  cloud?: CloudConfig;
  /** Monorepo support */
  monorepo?: MonorepoConfig;
}

/** Monorepo configuration */
export interface MonorepoConfig {
  /** Glob patterns for workspace packages (e.g., ["apps/*", "packages/*"]) */
  packages: string[];
  /** Per-workspace config overrides keyed by relative path */
  overrides?: Record<string, Partial<Pick<VibeCheckConfig, 'presets' | 'rules'>>>;
}

/** Cloud sync settings */
export interface CloudConfig {
  /** Enable Cloud sync */
  enabled?: boolean;
  /** Cloud project ID (set by `vibecheck cloud connect`) */
  projectId?: string;
  /** Auto-sync on Stop hook (default: true) */
  autoSync?: boolean;
  /** Glob patterns for file paths to exclude from sync */
  excludePaths?: string[];
}

/** Resolved per-rule configuration after merging presets + user config + defaults */
export interface ResolvedRuleConfig {
  /** Whether this rule is active */
  enabled: boolean;
  /** Resolved severity */
  severity: 'block' | 'warn' | 'info';
  /** Merged rule-specific options */
  options: Record<string, unknown>;
}

/** Fully resolved config after merging presets + user config + defaults */
export interface ResolvedConfig {
  /** Applied presets */
  presets: string[];
  /** Target agents */
  agents: AgentType[];
  /** Resolved rule configurations keyed by rule ID */
  rules: Map<string, ResolvedRuleConfig>;
}

// ─── Preset ─────────────────────────────────────────────────────────────────

/** A preset bundles rule configurations for a tech stack */
export interface Preset {
  /** Preset identifier (e.g., "nextjs-15") */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this preset enforces */
  description: string;
  /** Version for upgrade tracking */
  version: string;
  /** Rule configurations this preset provides */
  rules: Record<string, RuleConfig | boolean>;
}

// ─── Adapter ────────────────────────────────────────────────────────────────

/** A generated file from an adapter */
export interface GeneratedFile {
  /** Relative path from project root */
  path: string;
  /** File content */
  content: string;
  /** How to handle existing files */
  mergeStrategy: 'overwrite' | 'merge' | 'create-only';
}

/** Adapter generates agent-specific configuration from resolved rules */
export interface Adapter {
  /** Adapter identifier */
  id: AgentType;
  /** Human-readable name */
  name: string;
  /** Enforcement level this adapter provides */
  enforcement: 'runtime' | 'advisory';
  /** Generate agent-specific configuration files */
  generate(config: ResolvedConfig, projectRoot: string): Promise<GeneratedFile[]>;
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

/** A VibeCheck plugin package */
export interface VibeCheckPlugin {
  /** Plugin name (should match npm package name) */
  name: string;
  /** Plugin version */
  version: string;
  /** Additional rules provided by this plugin */
  rules?: Rule[];
  /** Additional presets provided by this plugin */
  presets?: Preset[];
}
