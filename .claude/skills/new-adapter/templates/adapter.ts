import type { Adapter, GeneratedFile, ResolvedConfig } from '../../types.js';
import { getAllRules } from '../../engine/registry.js';

/**
 * {{AGENT_NAME}} adapter.
 *
 * Generates:
 * {{OUTPUT_FILES_DESCRIPTION}}
 *
 * Enforcement is {{ENFORCEMENT}} only.
 */
export const {{ADAPTER_VAR_NAME}}: Adapter = {
  id: '{{AGENT_ID}}',
  name: '{{AGENT_NAME}}',
  enforcement: '{{ENFORCEMENT}}',

  async generate(config: ResolvedConfig): Promise<GeneratedFile[]> {
    const allRules = getAllRules();
    const files: GeneratedFile[] = [];

    // Collect active rules
    const activeRules: Array<{
      id: string;
      name: string;
      description: string;
      severity: string;
    }> = [];

    for (const [ruleId, ruleConfig] of config.rules) {
      if (!ruleConfig.enabled) continue;
      const rule = allRules.get(ruleId);
      if (!rule) continue;

      activeRules.push({
        id: ruleId,
        name: rule.name,
        description: rule.description,
        severity: ruleConfig.severity,
      });
    }

    // TODO: Generate agent-specific configuration files
    // Use activeRules to build the output content
    // Push GeneratedFile objects to the files array

    return files;
  },
};
