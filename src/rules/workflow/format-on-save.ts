import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule, RuleResult } from '../../types.js';

/**
 * workflow/format-on-save
 *
 * After a file is written/edited, detects the project's formatter and
 * suggests running it. Non-blocking — provides the command as metadata
 * for auto-formatting pipelines.
 *
 * Detects: Prettier, Biome, Black (Python), gofmt (Go), rustfmt (Rust).
 */
export const formatOnSave: Rule = {
  id: 'workflow/format-on-save',
  name: 'Format on Save',
  description: 'Suggests running the project formatter after file changes.',
  severity: 'info',
  events: ['PostToolUse'],
  match: { tools: ['Write', 'Edit'] },
  editCheck: false,

  check: (context): RuleResult => {
    const ruleId = 'workflow/format-on-save';
    const filePath = (context.toolInput.file_path as string) ?? '';

    if (!filePath) return { status: 'pass', ruleId };

    const projectRoot = context.gitContext.repoRoot;
    if (!projectRoot) return { status: 'pass', ruleId };

    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const formatter = detectFormatter(projectRoot, ext);

    if (!formatter) return { status: 'pass', ruleId };

    return {
      status: 'warn',
      ruleId,
      message: `File should be formatted with ${formatter.name}.`,
      fix: formatter.command,
      metadata: {
        formatter: formatter.name,
        command: formatter.command,
        file: filePath,
      },
    };
  },
};

interface FormatterInfo {
  name: string;
  command: string;
}

function detectFormatter(projectRoot: string, ext: string): FormatterInfo | null {
  // Python files → Black
  if (['py', 'pyi'].includes(ext)) {
    if (
      existsSync(join(projectRoot, 'pyproject.toml')) ||
      existsSync(join(projectRoot, '.flake8'))
    ) {
      return { name: 'Black', command: 'black --quiet' };
    }
    return null;
  }

  // Go files → gofmt
  if (ext === 'go') {
    return { name: 'gofmt', command: 'gofmt -w' };
  }

  // Rust files → rustfmt
  if (ext === 'rs') {
    return { name: 'rustfmt', command: 'rustfmt' };
  }

  // JS/TS/CSS/HTML → Check for Biome first, then Prettier
  const webExts = ['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs', 'css', 'scss', 'json', 'html', 'vue', 'svelte'];
  if (!webExts.includes(ext)) return null;

  // Biome
  if (existsSync(join(projectRoot, 'biome.json')) || existsSync(join(projectRoot, 'biome.jsonc'))) {
    return { name: 'Biome', command: 'biome format --write' };
  }

  // Prettier
  const prettierConfigs = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs', 'prettier.config.js', 'prettier.config.cjs', '.prettierrc.yaml', '.prettierrc.yml'];
  for (const config of prettierConfigs) {
    if (existsSync(join(projectRoot, config))) {
      return { name: 'Prettier', command: 'prettier --write' };
    }
  }

  return null;
}
