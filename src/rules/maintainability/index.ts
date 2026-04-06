import type { Rule } from '../../types.js';
import { cyclomaticComplexity } from './cyclomatic-complexity.js';
import { maxFunctionParams } from './max-function-params.js';
import { noDeepNesting } from './no-deep-nesting.js';
import { consistentReturns } from './consistent-returns.js';
import { noGodFiles } from './no-god-files.js';

export const maintainabilityRules: Rule[] = [
  cyclomaticComplexity,
  maxFunctionParams,
  noDeepNesting,
  consistentReturns,
  noGodFiles,
];

export { cyclomaticComplexity, maxFunctionParams, noDeepNesting, consistentReturns, noGodFiles };
