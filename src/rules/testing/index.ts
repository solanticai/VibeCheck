import type { Rule } from '../../types.js';
import { noTestSkip } from './no-test-skip.js';
import { mockCleanup } from './mock-cleanup.js';
import { assertionCount } from './assertion-count.js';
import { noSnapshotAbuse } from './no-snapshot-abuse.js';

export const testingRules: Rule[] = [noTestSkip, mockCleanup, assertionCount, noSnapshotAbuse];

export { noTestSkip, mockCleanup, assertionCount, noSnapshotAbuse };
