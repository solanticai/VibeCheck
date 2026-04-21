import type { Preset } from '../types.js';

/**
 * LangChain preset.
 *
 * Driven by the 2025-2026 CVE wave: CVE-2025-68664 (LangGrinch, CVSS 9.3),
 * CVE-2025-68665 (LangChain.js, 8.6), CVE-2026-34070 (path traversal, 7.5).
 * Known hot spots: pickle-based deserialisation in serializers, Jinja2
 * templates with untrusted input, path traversal in file-backed loaders,
 * prompt injection via fetched context.
 */
export const langchain: Preset = {
  id: 'langchain',
  name: 'LangChain',
  description:
    'LangChain / LangGraph conventions targeting the 2025-2026 CVE pattern (pickle, Jinja2, path traversal, prompt injection).',
  version: '1.0.0',
  rules: {
    'security/insecure-deserialization': true,
    'security/path-traversal': true,
    'security/prompt-injection': true,
    'security/unsafe-eval': true,
    'security/secret-detection': true,
    'security/mcp-server-allowlist': true,
    'security/mcp-credential-scope': true,
    'security/package-hallucination-guard': true,
    'quality/error-handling': true,
  },
};
