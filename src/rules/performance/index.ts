import type { Rule } from '../../types.js';
import { bundleSize } from './bundle-size.js';
import { noSyncIo } from './no-sync-io.js';
import { imageOptimization } from './image-optimization.js';

export const performanceRules: Rule[] = [bundleSize, noSyncIo, imageOptimization];

export { bundleSize, noSyncIo, imageOptimization };
