import { normalizePath } from './path.js';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Extracted function information from source code */
export interface FunctionInfo {
  /** Function name (or 'anonymous' for unnamed arrows) */
  name: string;
  /** 1-based start line */
  startLine: number;
  /** 1-based end line */
  endLine: number;
  /** Number of parameters */
  paramCount: number;
  /** Raw parameter string */
  params: string;
  /** Function body content (between outer braces) */
  body: string;
}

// ─── Test File Detection ───────────────────────────────────────────────────

/** Check if a file path is a test file */
export function isTestFile(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  if (/\.(test|spec|e2e)\.[tj]sx?$/.test(normalized)) return true;
  if (normalized.includes('/__tests__/')) return true;
  if (/\/tests?\//.test(normalized) && /\.[tj]sx?$/.test(normalized)) return true;
  return false;
}

// ─── Generated File Detection ──────────────────────────────────────────────

/** Check if a file path is a generated or vendor file */
export function isGeneratedFile(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return (
    normalized.includes('/generated/') ||
    normalized.includes('/vendor/') ||
    normalized.includes('.generated.') ||
    normalized.includes('.min.') ||
    normalized.includes('/dist/') ||
    normalized.includes('/node_modules/')
  );
}

// ─── Function Extraction ───────────────────────────────────────────────────

/**
 * Extract function boundaries from JS/TS source code using brace counting.
 * Handles: function declarations, arrow functions, class methods.
 * Single-pass O(n) scan — no AST required.
 */
export function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');

  // Patterns that start a function
  const functionPatterns = [
    // function name(params) {
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
    // const name = (params) => { or const name = async (params) => {
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]*?)?\s*=>/,
    // const name = function(params) {
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/,
    // class method: name(params) {
    /^\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]*)?\s*\{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const pattern of functionPatterns) {
      const match = pattern.exec(line);
      if (!match) continue;

      const name = match[1] || 'anonymous';
      const params = match[2] || '';
      const paramCount = countParams(params);

      // Find the opening brace
      let braceStart = -1;
      let searchLine = i;
      let combined = '';

      // Look for opening brace on current line or next few lines
      while (searchLine < lines.length && searchLine < i + 3) {
        combined += lines[searchLine];
        const braceIdx = combined.indexOf('{');
        if (braceIdx !== -1) {
          braceStart = searchLine;
          break;
        }
        searchLine++;
      }

      // Arrow functions without braces (single expression) — skip
      if (braceStart === -1) continue;

      // Count braces to find end
      let depth = 0;
      const bodyLines: string[] = [];
      let foundBody = false;

      for (let j = braceStart; j < lines.length; j++) {
        const bodyLine = lines[j];
        for (const ch of bodyLine) {
          if (ch === '{') {
            if (depth === 0) foundBody = true;
            depth++;
          } else if (ch === '}') {
            depth--;
            if (depth === 0 && foundBody) {
              // Found the closing brace
              functions.push({
                name,
                startLine: i + 1,
                endLine: j + 1,
                paramCount,
                params,
                body: bodyLines.join('\n'),
              });
              // Jump past this function to avoid double-matching
              // Don't set i = j because outer loop will continue scanning
              // for other functions that may start within (class methods)
              break;
            }
          }
        }
        if (depth === 0 && foundBody) break;
        if (foundBody) bodyLines.push(bodyLine);
      }
      break; // Only match first pattern per line
    }
  }

  return functions;
}

/** Count parameters in a param string. Destructured params count as 1. */
function countParams(params: string): number {
  const trimmed = params.trim();
  if (!trimmed) return 0;

  let count = 0;
  let depth = 0; // Track { } and [ ] nesting

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '{' || ch === '[' || ch === '<') depth++;
    else if (ch === '}' || ch === ']' || ch === '>') depth--;
    else if (ch === ',' && depth === 0) count++;
  }

  return count + 1; // N commas = N+1 params
}
