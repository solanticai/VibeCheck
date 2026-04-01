import type { Rule } from '../../types.js';
import { importAliases } from './import-aliases.js';
import { noUseClientInPages } from './no-use-client-in-pages.js';
import { namingConventions } from './naming-conventions.js';
import { noDeprecatedApi } from './no-deprecated-api.js';
import { antiPatterns } from './anti-patterns.js';
import { fileStructure } from './file-structure.js';
import { hallucinationGuard } from './hallucination-guard.js';

export const qualityRules: Rule[] = [
  importAliases,
  noUseClientInPages,
  namingConventions,
  noDeprecatedApi,
  antiPatterns,
  fileStructure,
  hallucinationGuard,
];

export {
  importAliases,
  noUseClientInPages,
  namingConventions,
  noDeprecatedApi,
  antiPatterns,
  fileStructure,
  hallucinationGuard,
};
