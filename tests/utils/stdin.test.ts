import { describe, it, expect } from 'vitest';
import { extractToolInput } from '../../src/utils/stdin.js';

describe('extractToolInput', () => {
  it('extracts tool_name and tool_input', () => {
    const data = {
      tool_name: 'Edit',
      tool_input: { file_path: '/src/index.ts', old_string: 'a', new_string: 'b' },
    };
    const result = extractToolInput(data);
    expect(result.toolName).toBe('Edit');
    expect(result.toolInput).toEqual({
      file_path: '/src/index.ts',
      old_string: 'a',
      new_string: 'b',
    });
  });

  it('defaults tool_name to empty string when missing', () => {
    const result = extractToolInput({});
    expect(result.toolName).toBe('');
  });

  it('defaults tool_input to empty object when missing', () => {
    const result = extractToolInput({ tool_name: 'Bash' });
    expect(result.toolInput).toEqual({});
  });

  it('handles both missing fields', () => {
    const result = extractToolInput({ unrelated: true });
    expect(result.toolName).toBe('');
    expect(result.toolInput).toEqual({});
  });
});

// Note: parseStdinJson and readStdinSync use real file descriptor 0 (stdin)
// which requires process-level mocking. These are better tested via integration tests.
