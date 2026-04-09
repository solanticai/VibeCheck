import { describe, it, expect } from 'vitest';

// The hook-entry module is the main runtime entry point. It calls
// process.exit, reads real stdin, and has many side effects. Testing it
// directly would require deep process-level mocking. Instead, we verify
// that the module's exported contract is correct — it exports exactly
// `executeHook` and that function is async.

describe('engine/hook-entry', () => {
  it('exports executeHook as an async function', async () => {
    const mod = await import('../../src/engine/hook-entry.js');
    expect(mod.executeHook).toBeTypeOf('function');
    // Verify it's async (returns a promise-like)
    expect(mod.executeHook.constructor.name).toBe('AsyncFunction');
  });

  it('does not export internal helper functions', async () => {
    const mod = await import('../../src/engine/hook-entry.js');
    const exported = Object.keys(mod);
    expect(exported).toEqual(['executeHook']);
  });
});
