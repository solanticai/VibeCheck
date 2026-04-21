import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

/**
 * Simple regex-based patterns: a single-file match is enough to conclude
 * XXE is enabled. Java is handled separately below because a negative
 * assertion across a whole file cannot be expressed safely as a single
 * regex (see the two-pass check in `javaXxeFinding`).
 */
const SINGLE_MATCH_PATTERNS: Array<[RegExp, string]> = [
  [
    /lxml\.etree\.XMLParser\s*\([^)]*resolve_entities\s*=\s*True/,
    'lxml XMLParser with resolve_entities=True — enables XXE attacks.',
  ],
  [
    /\bxml\.etree\.ElementTree\b[\s\S]{0,200}?\bno_entities\s*=\s*False/,
    'ElementTree parser with no_entities=False — XXE surface.',
  ],
  [
    /\blibxmljs\.parseXml\s*\([^)]*noent\s*:\s*true/i,
    'libxmljs parseXml with noent:true — entities will be resolved.',
  ],
];

/**
 * Java / Kotlin: `DocumentBuilderFactory.newInstance()` is only safe when
 * followed by explicit setFeature calls that disable external entities and
 * DOCTYPE declarations. A single regex with a negative lookahead after a
 * variable-length prefix can't express that correctly (backtracking will
 * always find a safe position and match anyway). Instead we do two
 * independent scans: one to confirm the unsafe constructor is called, and
 * one to confirm at least one of the known hardening features is set.
 */
const JAVA_FACTORY_PATTERN = /\bDocumentBuilderFactory\.newInstance\s*\(\s*\)/;

const JAVA_HARDENING_PATTERNS: RegExp[] = [
  // Disabling DOCTYPE entirely (strongest mitigation).
  /setFeature\s*\(\s*["']http:\/\/apache\.org\/xml\/features\/disallow-doctype-decl["']\s*,\s*true\s*\)/i,
  // Explicitly turning off external general entities.
  /setFeature\s*\(\s*["']http:\/\/xml\.org\/sax\/features\/external-general-entities["']\s*,\s*false\s*\)/i,
  // Explicitly turning off external parameter entities.
  /setFeature\s*\(\s*["']http:\/\/xml\.org\/sax\/features\/external-parameter-entities["']\s*,\s*false\s*\)/i,
  // Explicitly turning off external DTD loading.
  /setFeature\s*\(\s*["']http:\/\/apache\.org\/xml\/features\/nonvalidating\/load-external-dtd["']\s*,\s*false\s*\)/i,
  // setXIncludeAware(false) / setExpandEntityReferences(false) both harden XXE.
  /setXIncludeAware\s*\(\s*false\s*\)/,
  /setExpandEntityReferences\s*\(\s*false\s*\)/,
];

function javaXxeFinding(content: string): string | null {
  if (!JAVA_FACTORY_PATTERN.test(content)) return null;
  const hardened = JAVA_HARDENING_PATTERNS.some((p) => p.test(content));
  if (hardened) return null;
  return 'DocumentBuilderFactory.newInstance() without any hardening — external entities will be resolved (XXE).';
}

/**
 * security/xxe-prevention (CWE-611)
 *
 * Flags XML parsers configured to resolve external entities, a classic
 * data-exfil / SSRF vector that AI models frequently regenerate.
 *
 * Python / Node patterns match a single regex. Java requires a two-pass
 * check: the unsafe constructor must be present AND no recognised
 * hardening call must appear anywhere in the file.
 */
export const xxePrevention: Rule = {
  id: 'security/xxe-prevention',
  name: 'XXE Prevention',
  description: 'Blocks XML parser configurations that resolve external entities.',
  severity: 'block',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/xxe-prevention';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['py', 'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'java', 'kt'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    const fix =
      'Disable external entity resolution. Python: use defusedxml. Node: keep libxmljs noent=false. Java: set disallow-doctype-decl OR external-general-entities features to false on the factory.';

    for (const [pattern, message] of SINGLE_MATCH_PATTERNS) {
      if (pattern.test(content)) {
        return { status: 'block', ruleId, message, fix };
      }
    }

    if (ext === 'java' || ext === 'kt') {
      const message = javaXxeFinding(content);
      if (message) return { status: 'block', ruleId, message, fix };
    }

    return { status: 'pass', ruleId };
  },
};
