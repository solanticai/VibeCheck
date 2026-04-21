import type { Rule, RuleResult } from '../../types.js';
import { getExtension } from '../../utils/path.js';

const PATTERNS: Array<[RegExp, string]> = [
  [
    /crypto\.createHash\s*\(\s*['"`](?:md5|sha1)['"`]\s*\)/i,
    'MD5/SHA-1 via crypto.createHash — cryptographically broken.',
  ],
  [/\bhashlib\.(?:md5|sha1)\s*\(/, 'Python hashlib.md5/sha1 — cryptographically broken.'],
  [
    /MessageDigest\.getInstance\s*\(\s*"(?:MD5|SHA-1|SHA1)"/,
    'Java MessageDigest.getInstance("MD5"|"SHA-1") — cryptographically broken.',
  ],
  [
    /\b(?:Cipher|createCipheriv)\s*\(\s*['"`](?:des|rc4|aes-\d+-ecb)['"`]/i,
    'DES/RC4/AES-ECB — weak or mode-flawed cipher.',
  ],
];

/**
 * security/weak-crypto (CWE-327, CWE-328)
 *
 * Warns on broken hash algorithms (MD5, SHA-1) and weak/mode-flawed
 * ciphers (DES, RC4, AES-ECB). AI models still generate these when
 * prompted for "a simple hash" or "encryption".
 */
export const weakCrypto: Rule = {
  id: 'security/weak-crypto',
  name: 'Weak Cryptography',
  description: 'Warns on MD5/SHA-1 hashes and weak/ECB-mode ciphers.',
  severity: 'warn',
  events: ['PreToolUse'],
  match: { tools: ['Write'] },

  check: (context): RuleResult => {
    const ruleId = 'security/weak-crypto';
    const content = (context.toolInput.content as string) ?? '';
    const filePath = (context.toolInput.file_path as string) ?? '';
    if (!content || !filePath) return { status: 'pass', ruleId };

    const ext = getExtension(filePath);
    if (!['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'java', 'kt'].includes(ext)) {
      return { status: 'pass', ruleId };
    }
    if (/\.(test|spec|e2e)\.[tj]sx?$/.test(filePath)) return { status: 'pass', ruleId };

    for (const [pattern, message] of PATTERNS) {
      if (pattern.test(content)) {
        return {
          status: 'warn',
          ruleId,
          message,
          fix: 'Use SHA-256 or SHA-3 for hashing, bcrypt/argon2 for passwords, and AES-GCM or ChaCha20-Poly1305 for encryption.',
        };
      }
    }
    return { status: 'pass', ruleId };
  },
};
