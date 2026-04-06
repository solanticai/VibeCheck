import { describe, it, expect } from 'vitest';
import { extractFunctions, isTestFile, isGeneratedFile } from '../../src/utils/code-analysis.js';

describe('isTestFile', () => {
  it('should detect .test.ts files', () => {
    expect(isTestFile('/project/src/utils/math.test.ts')).toBe(true);
  });

  it('should detect .spec.tsx files', () => {
    expect(isTestFile('/project/src/Button.spec.tsx')).toBe(true);
  });

  it('should detect .e2e.ts files', () => {
    expect(isTestFile('/project/tests/login.e2e.ts')).toBe(true);
  });

  it('should detect __tests__ directory', () => {
    expect(isTestFile('/project/src/__tests__/utils.ts')).toBe(true);
  });

  it('should detect tests/ directory', () => {
    expect(isTestFile('/project/tests/rules/security.ts')).toBe(true);
  });

  it('should not flag regular source files', () => {
    expect(isTestFile('/project/src/utils/math.ts')).toBe(false);
  });

  it('should not flag files with "test" in name but no test pattern', () => {
    expect(isTestFile('/project/src/test-utils.ts')).toBe(false);
  });

  it('should handle Windows paths', () => {
    expect(isTestFile('C:\\project\\tests\\math.test.ts')).toBe(true);
  });
});

describe('isGeneratedFile', () => {
  it('should detect /generated/ directory', () => {
    expect(isGeneratedFile('/project/src/generated/types.ts')).toBe(true);
  });

  it('should detect /vendor/ directory', () => {
    expect(isGeneratedFile('/project/vendor/lib.js')).toBe(true);
  });

  it('should detect .generated. files', () => {
    expect(isGeneratedFile('/project/src/schema.generated.ts')).toBe(true);
  });

  it('should detect .min. files', () => {
    expect(isGeneratedFile('/project/dist/bundle.min.js')).toBe(true);
  });

  it('should detect /dist/ directory', () => {
    expect(isGeneratedFile('/project/dist/index.js')).toBe(true);
  });

  it('should detect node_modules', () => {
    expect(isGeneratedFile('/project/node_modules/lodash/index.js')).toBe(true);
  });

  it('should not flag regular source files', () => {
    expect(isGeneratedFile('/project/src/utils/helpers.ts')).toBe(false);
  });
});

describe('extractFunctions', () => {
  it('should extract named function declarations', () => {
    const content = `function add(a: number, b: number) {\n  return a + b;\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].name).toBe('add');
    expect(fns[0].paramCount).toBe(2);
  });

  it('should extract arrow functions assigned to const', () => {
    const content = `const multiply = (x: number, y: number) => {\n  return x * y;\n};`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].name).toBe('multiply');
    expect(fns[0].paramCount).toBe(2);
  });

  it('should extract async functions', () => {
    const content = `export async function fetchData(url: string) {\n  return await fetch(url);\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].name).toBe('fetchData');
    expect(fns[0].paramCount).toBe(1);
  });

  it('should count destructured params as 1', () => {
    const content = `function process({ id, name }: User, callback: () => void) {\n  return id;\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].paramCount).toBe(2);
  });

  it('should handle zero-parameter functions', () => {
    const content = `function init() {\n  return true;\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].paramCount).toBe(0);
  });

  it('should extract multiple functions', () => {
    const content = `function first() {\n  return 1;\n}\n\nfunction second(a: number) {\n  return a;\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(2);
    expect(fns[0].name).toBe('first');
    expect(fns[1].name).toBe('second');
  });

  it('should return empty array for non-function content', () => {
    const content = `const x = 5;\nconst y = "hello";`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(0);
  });

  it('should handle exported functions', () => {
    const content = `export function helper(a: string, b: string, c: number) {\n  return a + b;\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].name).toBe('helper');
    expect(fns[0].paramCount).toBe(3);
  });

  it('should include function body', () => {
    const content = `function example() {\n  const x = 1;\n  return x;\n}`;
    const fns = extractFunctions(content);
    expect(fns.length).toBe(1);
    expect(fns[0].body).toContain('const x = 1');
    expect(fns[0].body).toContain('return x');
  });
});
