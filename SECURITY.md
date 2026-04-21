# Security Policy

## Supported Versions

Security fixes are applied to the latest **minor** line of the current major release.
Older major lines receive critical-severity patches only for 90 days after a new major ships.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously at Anthril. If you discover a security vulnerability in VGuard, please report it responsibly.

### How to Report

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email us at **security@anthril.com** with:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Impact assessment** — what an attacker could achieve
4. **Affected versions** — which versions are impacted
5. **Suggested fix** (optional) — if you have a recommendation

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Initial assessment** within 5 business days
- **Resolution timeline** communicated after assessment
- **Credit** in the release notes (unless you prefer to remain anonymous)

### Scope

The following are in scope for security reports:

- **Rule bypass** — a way to circumvent VGuard's security rules during hook execution
- **Shell injection** — input that escapes validation and executes arbitrary commands
- **Path traversal** — accessing files outside the intended project directory
- **Configuration tampering** — unauthorized modification of VGuard config or generated hooks
- **Dependency vulnerabilities** — known CVEs in VGuard's direct dependencies
- **Cloud API** — authentication bypass or data leakage in the cloud sync feature

### Out of Scope

- Rules that are intentionally disabled by the user's configuration
- Vulnerabilities in AI agents themselves (Claude Code, Cursor, Codex, etc.)
- Issues requiring physical access to the developer's machine
- Social engineering attacks

## Security Design Principles

VGuard follows these security principles by design:

### Fail-Open Philosophy

All hooks exit with code 0 on internal errors. VGuard never blocks developer work due to its own failures. This is intentional — guardrails should assist, not obstruct.

### Input Validation

- File paths are validated against shell metacharacters before use
- npm package names are validated before dynamic resolution
- Hook events are checked against a strict allowlist
- Stdin payloads are parsed with size limits (2MB max)

### No Arbitrary Code Execution

- Generated hook scripts use static rule checks, not `eval()` or dynamic imports
- Ejected hooks are self-contained with no external dependencies
- Plugin loading validates package names before `require()`

### Minimal Permissions

- VGuard hooks run with the same permissions as the invoking AI agent
- No elevated privileges are requested or required
- File system access is limited to the project directory

## Disclosure Policy

We follow coordinated disclosure:

1. Reporter submits vulnerability privately
2. We confirm and assess the issue
3. We develop and test a fix
4. We release the fix and publish an advisory
5. Reporter is credited (with consent)

We aim to resolve critical vulnerabilities within 14 days of confirmation.
