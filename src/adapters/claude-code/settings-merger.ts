import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

interface SettingsJson {
  hooks?: Record<string, unknown[]>;
  [key: string]: unknown;
}

/**
 * Merge generated VibeCheck hooks into an existing .claude/settings.json.
 * Preserves non-vibecheck hooks and other settings.
 */
export async function mergeSettings(
  projectRoot: string,
  generatedSettings: SettingsJson,
): Promise<void> {
  const settingsPath = join(projectRoot, '.claude', 'settings.json');
  let existing: SettingsJson = {};

  // Read existing settings if they exist
  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, 'utf-8');
      existing = JSON.parse(raw);
    } catch {
      // If we can't parse it, start fresh
      existing = {};
    }
  }

  // Merge hooks: remove old vibecheck hooks, add new ones
  const mergedHooks: Record<string, unknown[]> = {};

  // Keep non-vibecheck hooks from existing settings
  if (existing.hooks) {
    for (const [event, hookGroups] of Object.entries(existing.hooks)) {
      if (Array.isArray(hookGroups)) {
        const nonVibecheck = hookGroups.filter((group) => {
          if (typeof group === 'object' && group !== null) {
            const hooks = (group as Record<string, unknown>).hooks;
            if (Array.isArray(hooks)) {
              return !hooks.some((h) => {
                const cmd = (h as Record<string, unknown>).command;
                return typeof cmd === 'string' && /vibecheck[-\s/\\]|\.vibecheck[/\\]/.test(cmd);
              });
            }
          }
          return true;
        });
        if (nonVibecheck.length > 0) {
          mergedHooks[event] = nonVibecheck;
        }
      }
    }
  }

  // Add generated vibecheck hooks
  if (generatedSettings.hooks) {
    for (const [event, hookGroups] of Object.entries(generatedSettings.hooks)) {
      if (!mergedHooks[event]) {
        mergedHooks[event] = [];
      }
      if (Array.isArray(hookGroups)) {
        mergedHooks[event].push(...hookGroups);
      }
    }
  }

  // Build final settings
  const final: SettingsJson = {
    ...existing,
    hooks: mergedHooks,
  };

  // Ensure directory exists
  const dir = dirname(settingsPath);
  await mkdir(dir, { recursive: true });

  // Write merged settings
  await writeFile(settingsPath, JSON.stringify(final, null, 2) + '\n', 'utf-8');
}
