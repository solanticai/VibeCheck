import type { Rule } from '../../types.js';
import { publicApiJsdoc } from './public-api-jsdoc.js';

export const documentationRules: Rule[] = [publicApiJsdoc];

export { publicApiJsdoc };
