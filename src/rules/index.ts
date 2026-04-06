import { registerRules } from '../engine/registry.js';
import { securityRules } from './security/index.js';
import { qualityRules } from './quality/index.js';
import { workflowRules } from './workflow/index.js';
import { performanceRules } from './performance/index.js';
import { maintainabilityRules } from './maintainability/index.js';
import { testingRules } from './testing/index.js';
import { reliabilityRules } from './reliability/index.js';
import { documentationRules } from './documentation/index.js';

/** All built-in rules */
export const allBuiltinRules = [
  ...securityRules,
  ...qualityRules,
  ...workflowRules,
  ...performanceRules,
  ...maintainabilityRules,
  ...testingRules,
  ...reliabilityRules,
  ...documentationRules,
];

/** Register all built-in rules with the engine */
export function registerBuiltinRules(): void {
  registerRules(allBuiltinRules);
}

// Auto-register on import
registerBuiltinRules();

export { securityRules } from './security/index.js';
export { qualityRules } from './quality/index.js';
export { workflowRules } from './workflow/index.js';
export { performanceRules } from './performance/index.js';
export { maintainabilityRules } from './maintainability/index.js';
export { testingRules } from './testing/index.js';
export { reliabilityRules } from './reliability/index.js';
export { documentationRules } from './documentation/index.js';
