import type { Adapter, GeneratedFile, ResolvedConfig, HookEvent } from '../../types.js';
import { getAllRules } from '../../engine/registry.js';
import { generateHookScript } from './hook-generator.js';
import { generateCommands } from './command-generator.js';
import { generateEnforcementRules } from './rules-generator.js';

/** Hook event types that VGuard generates scripts for */
const HOOK_EVENTS: HookEvent[] = ['PreToolUse', 'PostToolUse', 'Stop'];

/**
 * Claude Code adapter.
 *
 * Generates:
 * 1. Hook scripts (one per event type) in .vguard/hooks/
 * 2. settings.json entries in .claude/settings.json
 * 3. Command files in .claude/commands/vguard-*.md
 * 4. Enforcement rules in .claude/rules/vguard-enforcement.md
 */
export const claudeCodeAdapter: Adapter = {
  id: 'claude-code',
  name: 'Claude Code',
  enforcement: 'runtime',

  async generate(config: ResolvedConfig, projectRoot: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const allRules = getAllRules();

    // Determine which events have active rules
    const activeEvents = new Map<HookEvent, Set<string>>();

    for (const [ruleId, ruleConfig] of config.rules) {
      if (!ruleConfig.enabled) continue;

      const rule = allRules.get(ruleId);
      if (!rule) continue;

      for (const event of rule.events) {
        if (!activeEvents.has(event)) {
          activeEvents.set(event, new Set());
        }
        // Collect tool matchers for this event
        if (rule.match?.tools) {
          for (const tool of rule.match.tools) {
            activeEvents.get(event)!.add(tool);
          }
        }
      }
    }

    // Generate hook scripts for active events
    for (const event of HOOK_EVENTS) {
      if (!activeEvents.has(event)) continue;

      const hookScript = generateHookScript(event);
      files.push({
        path: `.vguard/hooks/vguard-${event.toLowerCase()}.js`,
        content: hookScript,
        mergeStrategy: 'overwrite',
      });
    }

    // Generate settings.json hook entries
    const settingsHooks = buildSettingsHooks(activeEvents, projectRoot);
    files.push({
      path: '.claude/settings.json',
      content: JSON.stringify(settingsHooks, null, 2),
      mergeStrategy: 'merge',
    });

    // Generate Claude Code commands (.claude/commands/vguard-*.md)
    const commandFiles = generateCommands(config);
    files.push(...commandFiles);

    // Generate enforcement rules (.claude/rules/vguard-enforcement.md)
    const rulesFile = generateEnforcementRules(config);
    files.push(rulesFile);

    return files;
  },
};

/**
 * Build the hooks section for .claude/settings.json.
 */
function buildSettingsHooks(
  activeEvents: Map<HookEvent, Set<string>>,
  _projectRoot: string,
): Record<string, unknown> {
  const hooks: Record<string, Array<Record<string, unknown>>> = {};

  for (const [event, tools] of activeEvents) {
    const toolMatcher = Array.from(tools).join('|');
    const hookScriptPath = `.vguard/hooks/vguard-${event.toLowerCase()}.js`;

    const hookEntry: Record<string, unknown> = {
      hooks: [
        {
          type: 'command',
          command: `node "${hookScriptPath}"`,
          timeout: event === 'Stop' ? 10000 : event === 'PostToolUse' ? 15000 : 10000,
        },
      ],
    };

    // Add matcher for PreToolUse and PostToolUse (Stop has no matcher)
    if (event !== 'Stop' && toolMatcher) {
      hookEntry.matcher = toolMatcher;
    }

    if (!hooks[event]) {
      hooks[event] = [];
    }
    hooks[event].push(hookEntry);
  }

  return { hooks };
}
