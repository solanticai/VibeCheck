import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execFileSyncMock = vi.fn();
const platformMock = vi.fn();
const userInfoMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));

vi.mock('node:os', () => ({
  platform: () => platformMock(),
  userInfo: () => userInfoMock(),
}));

import { restrictCredentialsAcl } from '../../src/cloud/acl-guard.js';

describe('restrictCredentialsAcl', () => {
  beforeEach(() => {
    execFileSyncMock.mockReset();
    platformMock.mockReset();
    userInfoMock.mockReset();
    userInfoMock.mockReturnValue({ username: 'tester' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op on linux', () => {
    platformMock.mockReturnValue('linux');
    restrictCredentialsAcl('/home/tester/.vguard/credentials.json');
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('is a no-op on darwin', () => {
    platformMock.mockReturnValue('darwin');
    restrictCredentialsAcl('/Users/tester/.vguard/credentials.json');
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('runs icacls on win32 with the current username', () => {
    platformMock.mockReturnValue('win32');
    userInfoMock.mockReturnValue({ username: 'john' });
    const path = 'C:\\Users\\john\\.vguard\\credentials.json';

    restrictCredentialsAcl(path);

    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const [cmd, args] = execFileSyncMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('icacls');
    expect(args).toEqual([path, '/inheritance:r', '/grant:r', 'john:F']);
  });

  it('swallows icacls failures to stay fail-open', () => {
    platformMock.mockReturnValue('win32');
    userInfoMock.mockReturnValue({ username: 'john' });
    execFileSyncMock.mockImplementation(() => {
      throw new Error('icacls not found');
    });

    expect(() =>
      restrictCredentialsAcl('C:\\Users\\john\\.vguard\\credentials.json'),
    ).not.toThrow();
  });

  it('skips when username is empty on win32', () => {
    platformMock.mockReturnValue('win32');
    userInfoMock.mockReturnValue({ username: '' });

    restrictCredentialsAcl('C:\\tmp\\creds.json');

    expect(execFileSyncMock).not.toHaveBeenCalled();
  });
});
