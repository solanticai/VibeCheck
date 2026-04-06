import type { Rule } from '../../types.js';
import { noUnhandledPromises } from './no-unhandled-promises.js';

export const reliabilityRules: Rule[] = [noUnhandledPromises];

export { noUnhandledPromises };
