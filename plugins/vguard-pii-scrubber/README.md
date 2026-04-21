# @anthril/vguard-pii-scrubber

Blocks writes to agent memory / context files (`CLAUDE.md`, `AGENTS.md`, `.claude/memory/**`, `.cursor/rules/**`) that contain PII (email, phone, SSN, Luhn-valid credit card, IPv4).

Ships the `pii-gdpr` preset which enables the single `pii/no-pii-in-memory` rule.
