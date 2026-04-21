# @anthril/vguard-compliance-sbom

Generates and validates CycloneDX SBOMs at session end. Prefers `syft` (if installed) for multi-ecosystem SBOMs; falls back to a minimal npm-only SBOM generator from `package.json`. Ships two rules (`sbom/up-to-date`, `sbom/sig-valid`) and the `eu-cra-2026` preset targeting the EU Cyber Resilience Act (Sept 2026).
