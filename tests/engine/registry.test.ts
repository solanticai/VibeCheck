import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerRule,
  registerRules,
  getRule,
  getAllRules,
  hasRule,
  getRuleIds,
  clearRegistry,
} from '../../src/engine/registry.js';
import type { Rule } from '../../src/types.js';

function makeRule(id: string): Rule {
  return {
    id,
    name: id,
    description: `Test rule ${id}`,
    severity: 'block',
    events: ['PreToolUse'],
    check: () => ({ status: 'pass', ruleId: id }),
  };
}

describe('Rule Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers a rule and retrieves it by ID', () => {
    const rule = makeRule('test/rule-one');
    registerRule(rule);
    expect(getRule('test/rule-one')).toBe(rule);
  });

  it('registers multiple rules at once', () => {
    const rules = [makeRule('test/a'), makeRule('test/b'), makeRule('test/c')];
    registerRules(rules);
    expect(getRuleIds()).toEqual(['test/a', 'test/b', 'test/c']);
  });

  it('throws on duplicate rule ID', () => {
    registerRule(makeRule('test/dup'));
    expect(() => registerRule(makeRule('test/dup'))).toThrow('Rule "test/dup" is already registered');
  });

  it('returns undefined for unknown rule ID', () => {
    expect(getRule('nonexistent/rule')).toBeUndefined();
  });

  it('getAllRules returns Map with all registered rules', () => {
    registerRules([makeRule('test/x'), makeRule('test/y')]);
    const all = getAllRules();
    expect(all).toBeInstanceOf(Map);
    expect(all.size).toBe(2);
    expect(all.has('test/x')).toBe(true);
    expect(all.has('test/y')).toBe(true);
  });

  it('getAllRules returns a copy (not the internal registry)', () => {
    registerRule(makeRule('test/orig'));
    const copy = getAllRules();
    copy.delete('test/orig');
    expect(hasRule('test/orig')).toBe(true);
  });

  it('hasRule returns true for registered rules', () => {
    registerRule(makeRule('test/exists'));
    expect(hasRule('test/exists')).toBe(true);
    expect(hasRule('test/missing')).toBe(false);
  });

  it('getRuleIds returns all registered IDs', () => {
    registerRules([makeRule('sec/a'), makeRule('qual/b')]);
    expect(getRuleIds()).toEqual(['sec/a', 'qual/b']);
  });

  it('clearRegistry removes all rules', () => {
    registerRules([makeRule('test/a'), makeRule('test/b')]);
    expect(getAllRules().size).toBe(2);
    clearRegistry();
    expect(getAllRules().size).toBe(0);
  });
});
