/**
 * Example VibeCheck plugin.
 *
 * This demonstrates how to create a plugin with custom rules and presets.
 * Install: npm install vibecheck-plugin-example
 * Configure: plugins: ['vibecheck-plugin-example'] in vibecheck.config.ts
 */

import type { VibeCheckPlugin, Rule, Preset } from 'vibecheck';

const noTodoComments: Rule = {
  id: 'example/no-todo-comments',
  name: 'No TODO Comments',
  description: 'Warns about TODO comments left in code.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },
  check: (context) => {
    const content = (context.toolInput.content as string) ?? '';
    if (/\/\/\s*TODO\b/i.test(content) || /\/\/\s*FIXME\b/i.test(content)) {
      return {
        status: 'warn',
        ruleId: 'example/no-todo-comments',
        message: 'TODO/FIXME comment detected. Track work items in your issue tracker instead.',
        fix: 'Create a GitHub issue and reference it in the code.',
      };
    }
    return { status: 'pass', ruleId: 'example/no-todo-comments' };
  },
};

const examplePreset: Preset = {
  id: 'example-strict',
  name: 'Example Strict',
  description: 'Example preset enabling the no-todo-comments rule.',
  version: '1.0.0',
  rules: {
    'example/no-todo-comments': true,
  },
};

const plugin: VibeCheckPlugin = {
  name: 'vibecheck-plugin-example',
  version: '1.0.0',
  rules: [noTodoComments],
  presets: [examplePreset],
};

export default plugin;
