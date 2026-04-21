# @anthril/vguard-prompt-injection-guard

Scans inbound content (WebFetch bodies, Read file outputs) for prompt-injection markers before the agent processes them. Ships one rule (`promptinjection/inbound-scan`) and one preset (`prompt-injection-defense`). Extensible via `additionalPatterns` in rule options.
