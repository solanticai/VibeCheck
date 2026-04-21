import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../../src/config/loader.js';
import { getAllPresets } from '../../src/config/presets.js';

// Register presets
import '../../src/presets/index.js';

describe('preset resolution', () => {
  const presetMap = getAllPresets();

  it('should have 37 built-in presets', () => {
    expect(presetMap.size).toBe(37);
    expect(presetMap.has('nextjs-15')).toBe(true);
    expect(presetMap.has('typescript-strict')).toBe(true);
    expect(presetMap.has('react-19')).toBe(true);
    expect(presetMap.has('supabase')).toBe(true);
    expect(presetMap.has('tailwind')).toBe(true);
    expect(presetMap.has('django')).toBe(true);
    expect(presetMap.has('fastapi')).toBe(true);
    expect(presetMap.has('laravel')).toBe(true);
    expect(presetMap.has('wordpress')).toBe(true);
    expect(presetMap.has('react-native')).toBe(true);
    expect(presetMap.has('astro')).toBe(true);
    expect(presetMap.has('sveltekit')).toBe(true);
    expect(presetMap.has('python-strict')).toBe(true);
    expect(presetMap.has('go')).toBe(true);
    expect(presetMap.has('vue')).toBe(true);
    expect(presetMap.has('remix')).toBe(true);
    expect(presetMap.has('prisma')).toBe(true);
    expect(presetMap.has('express')).toBe(true);
    expect(presetMap.has('dockerfile')).toBe(true);
    expect(presetMap.has('langchain')).toBe(true);
    expect(presetMap.has('drizzle')).toBe(true);
    expect(presetMap.has('terraform')).toBe(true);
    expect(presetMap.has('mcp-server')).toBe(true);
    expect(presetMap.has('kubernetes-manifests')).toBe(true);
    expect(presetMap.has('bun')).toBe(true);
    expect(presetMap.has('mongodb')).toBe(true);
    expect(presetMap.has('nestjs')).toBe(true);
    expect(presetMap.has('nuxt')).toBe(true);
    expect(presetMap.has('trpc')).toBe(true);
    expect(presetMap.has('zod-validation')).toBe(true);
    expect(presetMap.has('expo')).toBe(true);
    expect(presetMap.has('graphql')).toBe(true);
    expect(presetMap.has('deno')).toBe(true);
    expect(presetMap.has('grpc')).toBe(true);
    expect(presetMap.has('rails')).toBe(true);
    expect(presetMap.has('redis')).toBe(true);
    expect(presetMap.has('phoenix-elixir')).toBe(true);
  });

  it('nextjs-15 preset enables correct rules', () => {
    const config = resolveConfig({ presets: ['nextjs-15'] }, presetMap);
    expect(config.rules.has('quality/no-use-client-in-pages')).toBe(true);
    expect(config.rules.get('quality/no-use-client-in-pages')?.enabled).toBe(true);
    expect(config.rules.has('quality/import-aliases')).toBe(true);
  });

  it('tailwind preset enables anti-pattern CSS blocking', () => {
    const config = resolveConfig({ presets: ['tailwind'] }, presetMap);
    const antiPatternConfig = config.rules.get('quality/anti-patterns');
    expect(antiPatternConfig?.enabled).toBe(true);
    expect(antiPatternConfig?.options?.blockCssFiles).toBe(true);
    expect(antiPatternConfig?.options?.blockInlineStyles).toBe(true);
  });

  it('supabase preset enables migration-safety', () => {
    const config = resolveConfig({ presets: ['supabase'] }, presetMap);
    expect(config.rules.has('workflow/migration-safety')).toBe(true);
    expect(config.rules.get('workflow/migration-safety')?.enabled).toBe(true);
  });

  it('react-19 preset enables naming conventions', () => {
    const config = resolveConfig({ presets: ['react-19'] }, presetMap);
    expect(config.rules.has('quality/naming-conventions')).toBe(true);
    expect(config.rules.has('quality/no-deprecated-api')).toBe(true);
  });

  it('multiple presets compose correctly', () => {
    const config = resolveConfig({ presets: ['nextjs-15', 'tailwind', 'supabase'] }, presetMap);
    // All three presets' rules should be present
    expect(config.rules.has('quality/no-use-client-in-pages')).toBe(true);
    expect(config.rules.has('quality/anti-patterns')).toBe(true);
    expect(config.rules.has('workflow/migration-safety')).toBe(true);
  });

  it('user can override preset rules', () => {
    const config = resolveConfig(
      {
        presets: ['tailwind'],
        rules: { 'quality/anti-patterns': false },
      },
      presetMap,
    );
    expect(config.rules.get('quality/anti-patterns')?.enabled).toBe(false);
  });
});
