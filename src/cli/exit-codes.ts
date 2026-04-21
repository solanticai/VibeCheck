/**
 * Exit-code table used by every CLI surface.
 *
 * `LINT_BLOCKING` is deliberately `3` (not `1`) so CI scripts can
 * distinguish a lint-found-issues exit from a generic failure like an
 * uncaught Node error (which exits `1`) or a usage error (which exits
 * `2`). Scripts that only care about "any failure" should use
 * `$? -ne 0` and stay agnostic to the specific code.
 */
export const EXIT = {
  OK: 0,
  USAGE: 2,
  LINT_BLOCKING: 3,
  DATA_ERR: 65,
  NO_INPUT: 66,
  UNAVAILABLE: 69,
  SOFTWARE: 70,
  NO_PERM: 77,
  CONFIG: 78,
  SIGINT: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
