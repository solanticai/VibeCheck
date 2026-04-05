import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hasValidCredentials, readCredentials, writeCredentials } from '../../cloud/credentials.js';
import { CloudClient } from '../../cloud/client.js';

const CLOUD_URL = process.env.VGUARD_CLOUD_URL ?? 'https://vguard.dev';

/**
 * `vguard cloud connect`
 *
 * Registers the current repository with VGuard Cloud.
 * Auto-updates vguard.config.ts and saves API key to .env.local.
 */
export async function cloudConnectCommand(
  options: { name?: string; key?: string; projectId?: string } = {},
): Promise<void> {
  const projectRoot = process.cwd();

  console.log('\n  VGuard Cloud — Connect Repository\n');

  let apiKey: string;
  let projectId: string;

  if (options.key && options.projectId) {
    apiKey = options.key;
    projectId = options.projectId;
  } else {
    if (!hasValidCredentials()) {
      console.log('  Not logged in. You have two options:\n');
      console.log('  Option A — Login via browser:');
      console.log(`    1. Visit ${CLOUD_URL}/cli`);
      console.log('    2. Copy the command and run it');
      console.log('    3. Then run: npx vguard cloud connect\n');
      console.log('  Option B — Use an existing API key:');
      console.log('    npx vguard cloud connect --key <vc_key> --project-id <id>\n');
      console.log('  Create a project at the dashboard to get your key and ID.\n');
      process.exit(1);
    }

    const projectName = options.name ?? projectRoot.split(/[/\\]/).pop() ?? 'unnamed';

    try {
      const client = new CloudClient();
      const result = await client.connectProject(projectName);
      apiKey = result.apiKey;
      projectId = result.projectId;

      console.log(`  Project registered: ${projectName}`);
      console.log(`  Project ID: ${projectId}`);
      console.log(`  API Key: ${apiKey}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`  Failed to connect: ${message}\n`);
      process.exit(1);
    }
  }

  // Save API key and project ID to credentials.
  // Always persist so Claude Code hooks can read them, even when the user
  // connects via --key/--project-id without having run `cloud login` first.
  const creds = readCredentials();
  writeCredentials({ ...(creds ?? {}), apiKey, projectId });
  console.log('  Saved API key to credentials.');

  // Auto-update vguard.config.ts
  if (updateConfigFile(projectRoot, projectId)) {
    console.log('  Updated vguard.config.ts with cloud settings.');
  }

  // Also write to .env.local for Next.js / framework access
  if (updateEnvFile(projectRoot, apiKey)) {
    console.log('  Saved API key to .env.local');
  }

  console.log('\n  Cloud connected! Run `npx vguard generate` to rebuild hooks.\n');
}

function updateConfigFile(projectRoot: string, projectId: string): boolean {
  const configPath = join(projectRoot, 'vguard.config.ts');
  if (!existsSync(configPath)) return false;

  try {
    let content = readFileSync(configPath, 'utf-8');

    if (/cloud\s*:\s*\{/.test(content)) {
      // Update existing projectId
      content = content.replace(/projectId\s*:\s*['"][^'"]*['"]/, `projectId: '${projectId}'`);

      // Upsert enabled: true. `cloud connect` is an explicit opt-in to
      // real-time cloud sync, so any existing `enabled: false` must
      // flip to true. If the field is missing, insert it after the
      // cloud: { opening brace.
      if (/enabled\s*:\s*(?:true|false)/.test(content)) {
        content = content.replace(/enabled\s*:\s*false/, 'enabled: true');
      } else {
        content = content.replace(/(cloud\s*:\s*\{\s*\n)/, `$1    enabled: true,\n`);
      }

      // Upsert autoSync: true for the same reason — `cloud connect`
      // should opt the project into real-time streaming by default.
      if (/autoSync\s*:\s*(?:true|false)/.test(content)) {
        content = content.replace(/autoSync\s*:\s*false/, 'autoSync: true');
      } else {
        content = content.replace(
          /(projectId\s*:\s*['"][^'"]*['"],?\s*\n)/,
          `$1    autoSync: true,\n`,
        );
      }
    } else {
      // Ensure the last property before }); has a trailing comma
      content = content.replace(/(\s*)(}|])\s*\n(\}\);?\s*)$/, '$1$2,\n$3');

      // Insert cloud config before the closing });
      const cloudBlock = [
        '  cloud: {',
        '    enabled: true,',
        `    projectId: '${projectId}',`,
        '    autoSync: true,',
        '  },',
      ].join('\n');
      content = content.replace(/(\n\}\);?\s*)$/, `\n${cloudBlock}\n});`);
    }

    writeFileSync(configPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function updateEnvFile(projectRoot: string, apiKey: string): boolean {
  const envPath = join(projectRoot, '.env.local');

  try {
    let content = '';

    if (existsSync(envPath)) {
      content = readFileSync(envPath, 'utf-8');
      if (/^VGUARD_API_KEY=/m.test(content)) {
        content = content.replace(/^VGUARD_API_KEY=.*$/m, `VGUARD_API_KEY=${apiKey}`);
      } else {
        if (!content.endsWith('\n')) content += '\n';
        content += `\n# VGuard Cloud\nVGUARD_API_KEY=${apiKey}\n`;
      }
    } else {
      content = `# VGuard Cloud\nVGUARD_API_KEY=${apiKey}\n`;
    }

    writeFileSync(envPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
