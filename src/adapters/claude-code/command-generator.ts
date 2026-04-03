import type { GeneratedFile, ResolvedConfig } from '../../types.js';
import { getCommandTemplates } from './templates/command-templates.js';

/**
 * Generate Claude Code command files (.claude/commands/vguard-*.md).
 *
 * Uses 'create-only' strategy so user customizations are preserved.
 * Commands become available as `/project:vguard-<name>` slash commands.
 */
export function generateCommands(config: ResolvedConfig): GeneratedFile[] {
  const templates = getCommandTemplates(config);
  const files: GeneratedFile[] = [];

  for (const [name, content] of templates) {
    files.push({
      path: `.claude/commands/${name}.md`,
      content,
      mergeStrategy: 'create-only',
    });
  }

  return files;
}
