# @anthril/vguard-sast-bridge

Wraps four open-source SAST tools — `semgrep`, `bandit`, `brakeman`, `sobelow` — as VGuard rules. Each wrapper rule is a no-op when its binary is not installed, so you can enable the `sast-standard` preset without worrying about which of the four is available on a given machine.
