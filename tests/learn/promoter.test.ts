import { describe, it, expect } from 'vitest';
import { getPromotionSuggestions, mergePromotions } from '../../src/learn/promoter.js';
import type { DiscoveredPattern } from '../../src/learn/analyzers/types.js';

const patterns: DiscoveredPattern[] = [
  {
    type: 'import',
    description: 'Path alias "@/" used',
    confidence: 0.9,
    occurrences: 50,
    totalFiles: 60,
    examples: [],
    promotable: true,
    suggestedRule: { ruleId: 'quality/import-aliases', config: { aliases: ['@/'] } },
  },
  {
    type: 'naming',
    description: 'PascalCase components',
    confidence: 0.8,
    occurrences: 20,
    totalFiles: 25,
    examples: [],
    promotable: true,
    suggestedRule: {
      ruleId: 'quality/naming-conventions',
      config: { componentDirs: ['/components/'] },
    },
  },
  {
    type: 'structure',
    description: 'Directory layout info',
    confidence: 1,
    occurrences: 100,
    totalFiles: 100,
    examples: [],
    promotable: false,
  },
  {
    type: 'import',
    description: 'Low confidence pattern',
    confidence: 0.3,
    occurrences: 2,
    totalFiles: 60,
    examples: [],
    promotable: true,
    suggestedRule: { ruleId: 'quality/import-aliases', config: {} },
  },
];

describe('getPromotionSuggestions', () => {
  it('should return promotable patterns above threshold', () => {
    const suggestions = getPromotionSuggestions(patterns, 0.7);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].ruleId).toBe('quality/import-aliases');
    expect(suggestions[1].ruleId).toBe('quality/naming-conventions');
  });

  it('should filter out non-promotable patterns', () => {
    const suggestions = getPromotionSuggestions(patterns, 0.7);
    expect(suggestions.every((s) => s.ruleId !== undefined)).toBe(true);
  });

  it('should filter out low-confidence patterns', () => {
    const suggestions = getPromotionSuggestions(patterns, 0.7);
    expect(suggestions.every((s) => s.confidence >= 0.7)).toBe(true);
  });
});

describe('mergePromotions', () => {
  it('should merge suggestions by ruleId', () => {
    const suggestions = getPromotionSuggestions(patterns, 0.7);
    const merged = mergePromotions(suggestions);
    expect(Object.keys(merged)).toHaveLength(2);
    expect(merged['quality/import-aliases']).toEqual({ aliases: ['@/'] });
  });
});
