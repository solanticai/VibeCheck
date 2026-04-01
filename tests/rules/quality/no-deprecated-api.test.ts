import { describe, it, expect } from 'vitest';
import { noDeprecatedApi } from '../../../src/rules/quality/no-deprecated-api.js';
import type { HookContext } from '../../../src/types.js';

function ctx(content: string, filePath = '/p/src/App.tsx'): HookContext {
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: { content, file_path: filePath },
    projectConfig: { presets: [], agents: ['claude-code'], rules: new Map() },
    gitContext: {
      branch: 'feat/test',
      isDirty: false,
      repoRoot: '/p',
      unpushedCount: 0,
      hasRemote: false,
    },
  };
}

describe('quality/no-deprecated-api', () => {
  it('should detect cacheTime (React Query v4)', () => {
    const r = noDeprecatedApi.check(ctx('const query = useQuery({ cacheTime: 5000 });'));
    expect(r.status).toBe('block');
    expect(r.message).toContain('cacheTime');
    expect(r.fix).toContain('gcTime');
  });

  it('should detect getServerSideProps', () => {
    const r = noDeprecatedApi.check(ctx('export async function getServerSideProps() {}'));
    expect(r.status).toBe('block');
    expect(r.message).toContain('getServerSideProps');
  });

  it('should detect getStaticProps', () => {
    const r = noDeprecatedApi.check(ctx('export async function getStaticProps() {}'));
    expect(r.status).toBe('block');
  });

  it('should detect React.FC', () => {
    const r = noDeprecatedApi.check(ctx('const App: React.FC = () => <div />;'));
    expect(r.status).toBe('block');
    expect(r.message).toContain('React.FC');
  });

  it('should pass for modern patterns', () => {
    const r = noDeprecatedApi.check(
      ctx('export default async function Page() { return <div />; }'),
    );
    expect(r.status).toBe('pass');
  });

  it('should skip non-TS/JS files', () => {
    const r = noDeprecatedApi.check(ctx('cacheTime in markdown', '/p/README.md'));
    expect(r.status).toBe('pass');
  });

  it('should pass on empty content', () => {
    const r = noDeprecatedApi.check(ctx(''));
    expect(r.status).toBe('pass');
  });
});
