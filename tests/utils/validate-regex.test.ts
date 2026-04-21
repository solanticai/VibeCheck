import { describe, it, expect } from 'vitest';
import { validateUserRegex } from '../../src/utils/validate-regex.js';

describe('validateUserRegex', () => {
  describe('benign patterns', () => {
    it('compiles a simple literal', () => {
      const re = validateUserRegex('foo');
      expect(re).toBeInstanceOf(RegExp);
      expect(re.test('foobar')).toBe(true);
    });

    it('compiles with flags', () => {
      const re = validateUserRegex('hello', 'i');
      expect(re.test('HELLO')).toBe(true);
    });

    it('compiles a modestly complex pattern', () => {
      const re = validateUserRegex('^foo[0-9]+(?:bar)?$');
      expect(re.test('foo123bar')).toBe(true);
      expect(re.test('foo999')).toBe(true);
      expect(re.test('baz')).toBe(false);
    });

    it('compiles the default branch-naming pattern shape', () => {
      const re = validateUserRegex('^(feature|fix|chore)/.+$');
      expect(re.test('feature/abc')).toBe(true);
      expect(re.test('main')).toBe(false);
    });
  });

  describe('ReDoS patterns', () => {
    it('rejects (a+)+', () => {
      expect(() => validateUserRegex('(a+)+b')).toThrow(/nested unbounded quantifier|backtracking/);
    });

    it('rejects (a*)+ variant', () => {
      expect(() => validateUserRegex('(a*)*b')).toThrow(/nested unbounded quantifier|backtracking/);
    });

    it('rejects the issue #49 repro pattern', () => {
      expect(() => validateUserRegex('^(([a-z])+.)+[A-Z]([a-z])+$')).toThrow();
    });

    it('rejects unbounded {n,} inside a repeated group', () => {
      expect(() => validateUserRegex('(a{2,})+b')).toThrow(
        /nested unbounded quantifier|backtracking/,
      );
    });
  });

  describe('invalid regex', () => {
    it('throws on unbalanced parens', () => {
      expect(() => validateUserRegex('(foo')).toThrow(/invalid regex/);
    });

    it('includes the label in error messages', () => {
      expect(() => validateUserRegex('(a+)+', '', { label: 'test.pattern' })).toThrow(
        /test\.pattern/,
      );
    });
  });
});
