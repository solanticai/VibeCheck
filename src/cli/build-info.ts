declare const __VGUARD_VERSION__: string;
declare const __VGUARD_GIT_SHA__: string;
declare const __VGUARD_BUILD_DATE__: string;

function safe(value: string | undefined, fallback: string): string {
  return value && value !== 'unknown' ? value : fallback;
}

export const BUILD_INFO = {
  version: safe(
    typeof __VGUARD_VERSION__ !== 'undefined' ? __VGUARD_VERSION__ : undefined,
    '0.0.0-dev',
  ),
  gitSha: safe(
    typeof __VGUARD_GIT_SHA__ !== 'undefined' ? __VGUARD_GIT_SHA__ : undefined,
    'unknown',
  ),
  buildDate: safe(
    typeof __VGUARD_BUILD_DATE__ !== 'undefined' ? __VGUARD_BUILD_DATE__ : undefined,
    'unknown',
  ),
};

export function formatVersion(): string {
  const { version, gitSha, buildDate } = BUILD_INFO;
  const extras: string[] = [];
  if (gitSha !== 'unknown') extras.push(gitSha);
  if (buildDate !== 'unknown') extras.push(buildDate);
  // Node runtime is useful for bug reports.
  const nodeVersion = typeof process !== 'undefined' ? process.version : '';
  if (nodeVersion) extras.push(`node ${nodeVersion}`);
  return extras.length ? `${version} (${extras.join(', ')})` : version;
}
