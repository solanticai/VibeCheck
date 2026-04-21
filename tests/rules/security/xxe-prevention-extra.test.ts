import { describe, it, expect } from 'vitest';
import { xxePrevention } from '../../../src/rules/security/xxe-prevention.js';
import { jwtValidation } from '../../../src/rules/security/jwt-validation.js';
import type { HookContext, ResolvedConfig } from '../../../src/types.js';

function ctx(filePath: string, content: string): HookContext {
  const projectConfig: ResolvedConfig = {
    presets: [],
    agents: ['claude-code'],
    rules: new Map(),
  };
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: { file_path: filePath, content },
    projectConfig,
    gitContext: {
      branch: 'feature/x',
      isDirty: false,
      repoRoot: '/project',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('security/xxe-prevention — Java DocumentBuilderFactory (two-pass)', () => {
  it('blocks newInstance() with no hardening', async () => {
    const java = `
      public Document parse(String xml) {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new InputSource(new StringReader(xml)));
      }
    `;
    const r = await xxePrevention.check(ctx('/p/Parser.java', java));
    expect(r.status).toBe('block');
    expect(r.message).toContain('DocumentBuilderFactory');
  });

  it('passes when disallow-doctype-decl is set', async () => {
    const java = `
      DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
      factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      DocumentBuilder builder = factory.newDocumentBuilder();
    `;
    const r = await xxePrevention.check(ctx('/p/Parser.java', java));
    expect(r.status).toBe('pass');
  });

  it('passes when external-general-entities is disabled', async () => {
    const java = `
      DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
      factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
      DocumentBuilder builder = factory.newDocumentBuilder();
    `;
    const r = await xxePrevention.check(ctx('/p/Parser.java', java));
    expect(r.status).toBe('pass');
  });

  it('passes when setExpandEntityReferences(false) is set', async () => {
    const java = `
      DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
      factory.setExpandEntityReferences(false);
      DocumentBuilder builder = factory.newDocumentBuilder();
    `;
    const r = await xxePrevention.check(ctx('/p/Parser.java', java));
    expect(r.status).toBe('pass');
  });

  it('passes when load-external-dtd is disabled', async () => {
    const java = `
      DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
      factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
    `;
    const r = await xxePrevention.check(ctx('/p/Parser.java', java));
    expect(r.status).toBe('pass');
  });

  it('passes on Kotlin code with hardening', async () => {
    const kotlin = `
      val factory = DocumentBuilderFactory.newInstance()
      factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
    `;
    const r = await xxePrevention.check(ctx('/p/Parser.kt', kotlin));
    expect(r.status).toBe('pass');
  });

  it('still catches unsafe Python lxml usage', async () => {
    const py = `parser = lxml.etree.XMLParser(resolve_entities=True)`;
    const r = await xxePrevention.check(ctx('/p/x.py', py));
    expect(r.status).toBe('block');
  });

  it('skips non-XML-relevant file types', async () => {
    const md = `DocumentBuilderFactory.newInstance() example`;
    const r = await xxePrevention.check(ctx('/p/README.md', md));
    expect(r.status).toBe('pass');
  });
});

describe('security/jwt-validation — function-scope decode-without-verify', () => {
  it('passes when decode and verify live in the same function', async () => {
    const code = `
      export function checkToken(token) {
        const claims = jwt.verify(token, process.env.JWT_SECRET);
        const decoded = jwt.decode(token);
        return decoded.sub === claims.sub;
      }
    `;
    const r = await jwtValidation.check(ctx('/p/src/auth.ts', code));
    expect(r.status).toBe('pass');
  });

  it('blocks when decode is in a function with no verify', async () => {
    const code = `
      export function readClaims(token) {
        return jwt.decode(token);
      }

      export function verifyToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET);
      }
    `;
    const r = await jwtValidation.check(ctx('/p/src/auth.ts', code));
    expect(r.status).toBe('block');
    expect((r.metadata as { scope?: string })?.scope).toBe('function');
  });

  it('blocks module-level decode when no verify anywhere', async () => {
    const code = `
      const decoded = jwt.decode(token);
      export default decoded;
    `;
    const r = await jwtValidation.check(ctx('/p/src/auth.ts', code));
    expect(r.status).toBe('block');
    expect((r.metadata as { scope?: string })?.scope).toBe('module');
  });

  it('passes module-level decode when a verify exists somewhere in the file', async () => {
    // Module-level decode is conservative fallback — still checks whole file.
    const code = `
      export function v(t) { return jwt.verify(t, process.env.SECRET); }
      const decoded = jwt.decode(token);
    `;
    const r = await jwtValidation.check(ctx('/p/src/auth.ts', code));
    expect(r.status).toBe('pass');
  });
});
