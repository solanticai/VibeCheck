# @anthril/vguard-secret-scanner-ext

Wraps `gitleaks` or `trufflehog` for deeper secret detection than the core `security/secret-detection` regex bank. Prefers `trufflehog --only-verified` (actually authenticates found credentials) when installed; falls back to `gitleaks detect`. Fails open when neither binary is available.

```typescript
// vguard.config.ts
import { defineConfig } from '@anthril/vguard';

export default defineConfig({
  plugins: ['@anthril/vguard-secret-scanner-ext'],
  rules: { 'secret-scanner-ext/deep-scan': { severity: 'block' } },
});
```

Install one of:

```bash
brew install trufflehog        # preferred
brew install gitleaks          # fallback
```
