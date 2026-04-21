import type { Rule } from '../../types.js';
import { importAliases } from './import-aliases.js';
import { noUseClientInPages } from './no-use-client-in-pages.js';
import { namingConventions } from './naming-conventions.js';
import { noDeprecatedApi } from './no-deprecated-api.js';
import { antiPatterns } from './anti-patterns.js';
import { fileStructure } from './file-structure.js';
import { hallucinationGuard } from './hallucination-guard.js';
import { testCoverage } from './test-coverage.js';
import { maxFileLength } from './max-file-length.js';
import { noConsoleLog } from './no-console-log.js';
import { deadExports } from './dead-exports.js';
import { noAnyType } from './no-any-type.js';
import { errorHandling } from './error-handling.js';
import { a11yJsx } from './a11y-jsx.js';
import { magicNumbers } from './magic-numbers.js';
import { raceConditionHint } from './race-condition-hint.js';
import { packageExistenceCheck } from './package-existence-check.js';
import { nuxtUseStatePerRequest } from './nuxt-usestate-per-request.js';
import { zodNoAnySchema } from './zod-no-any-schema.js';
import { zodRequireStripOrStrict } from './zod-require-strip-or-strict.js';

export const qualityRules: Rule[] = [
  importAliases,
  noUseClientInPages,
  namingConventions,
  noDeprecatedApi,
  antiPatterns,
  fileStructure,
  hallucinationGuard,
  testCoverage,
  maxFileLength,
  noConsoleLog,
  deadExports,
  noAnyType,
  errorHandling,
  a11yJsx,
  magicNumbers,
  raceConditionHint,
  packageExistenceCheck,
  nuxtUseStatePerRequest,
  zodNoAnySchema,
  zodRequireStripOrStrict,
];

export {
  importAliases,
  noUseClientInPages,
  namingConventions,
  noDeprecatedApi,
  antiPatterns,
  fileStructure,
  hallucinationGuard,
  testCoverage,
  maxFileLength,
  noConsoleLog,
  deadExports,
  noAnyType,
  errorHandling,
  a11yJsx,
  magicNumbers,
  raceConditionHint,
  packageExistenceCheck,
  nuxtUseStatePerRequest,
  zodNoAnySchema,
  zodRequireStripOrStrict,
};
