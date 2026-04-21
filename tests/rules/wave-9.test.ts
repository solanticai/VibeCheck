import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookContext, ResolvedConfig } from '../../src/types.js';
import { expoNoPlainSecureStore } from '../../src/rules/security/expo-no-plain-secure-store.js';
import { expoEasUpdateSigning } from '../../src/rules/security/expo-eas-update-signing.js';
import { expoConfigPluginReview } from '../../src/rules/security/expo-config-plugin-review.js';
import { expoNoExperimentalRscInProd } from '../../src/rules/security/expo-no-experimental-rsc-in-prod.js';
import { graphqlNoIntrospectionInProd } from '../../src/rules/security/graphql-no-introspection-in-prod.js';
import { graphqlDepthLimit } from '../../src/rules/security/graphql-depth-limit.js';
import { graphqlComplexityLimit } from '../../src/rules/security/graphql-complexity-limit.js';
import { graphqlResolverInputValidation } from '../../src/rules/security/graphql-resolver-input-validation.js';
import { denoPermissionsAudit } from '../../src/rules/security/deno-permissions-audit.js';
import { denoImportMapPinning } from '../../src/rules/security/deno-import-map-pinning.js';
import { denoNoEvalFfi } from '../../src/rules/security/deno-no-eval-ffi.js';
import { grpcTlsRequired } from '../../src/rules/security/grpc-tls-required.js';
import { grpcAuthInterceptor } from '../../src/rules/security/grpc-auth-interceptor.js';
import { grpcMaxMessageSize } from '../../src/rules/security/grpc-max-message-size.js';
import { grpcDeadlinePropagation } from '../../src/rules/security/grpc-deadline-propagation.js';
import { railsMassAssignmentStrongParams } from '../../src/rules/security/rails-mass-assignment-strong-params.js';
import { railsBrakemanRequired } from '../../src/rules/security/rails-brakeman-required.js';
import { railsCspDefaultDeny } from '../../src/rules/security/rails-csp-default-deny.js';
import { railsEncryptedAttrOnPii } from '../../src/rules/security/rails-encrypted-attr-on-pii.js';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vg-w9-'));
});
afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  const projectConfig: ResolvedConfig = { presets: [], agents: ['claude-code'], rules: new Map() };
  return {
    event: 'PreToolUse',
    tool: 'Write',
    toolInput: {},
    projectConfig,
    gitContext: {
      branch: 'main',
      isDirty: false,
      repoRoot: tmp,
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

// ─── Expo ─────────────────────────────────────────────────────────────────

describe('security/expo-no-plain-secure-store', () => {
  it('warns without keychainAccessible option', async () => {
    const r = await expoNoPlainSecureStore.check(
      ctx({
        toolInput: {
          file_path: '/p/src/secure.ts',
          content: 'await SecureStore.setItemAsync("k", "v");',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with keychainAccessible', async () => {
    const r = await expoNoPlainSecureStore.check(
      ctx({
        toolInput: {
          file_path: '/p/src/secure.ts',
          content:
            'await SecureStore.setItemAsync("k", "v", { keychainAccessible: SecureStore.WHEN_UNLOCKED });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/expo-eas-update-signing', () => {
  it('warns when eas.json has updates but no codeSigningCertificate', async () => {
    const r = await expoEasUpdateSigning.check(
      ctx({
        toolInput: {
          file_path: '/p/eas.json',
          content: '{"updates": {"url": "https://u.expo.dev/x"}}',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with codeSigningCertificate', async () => {
    const r = await expoEasUpdateSigning.check(
      ctx({
        toolInput: {
          file_path: '/p/eas.json',
          content:
            '{"updates": {"url": "https://u.expo.dev/x", "codeSigningCertificate": "./cert.pem"}}',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/expo-config-plugin-review', () => {
  it('warns on non-Expo config plugin', async () => {
    const r = await expoConfigPluginReview.check(
      ctx({
        toolInput: {
          file_path: '/p/app.json',
          content: '{"expo":{"plugins":["sketchy-community-plugin"]}}',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with expo-* plugins only', async () => {
    const r = await expoConfigPluginReview.check(
      ctx({
        toolInput: {
          file_path: '/p/app.json',
          content: '{"expo":{"plugins":["expo-router","expo-secure-store"]}}',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/expo-no-experimental-rsc-in-prod', () => {
  it('warns when reactServerComponents:true', async () => {
    const r = await expoNoExperimentalRscInProd.check(
      ctx({
        toolInput: {
          file_path: '/p/app.json',
          content: '{"expo":{"experiments":{"reactServerComponents":true}}}',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes without experimental RSC', async () => {
    const r = await expoNoExperimentalRscInProd.check(
      ctx({
        toolInput: { file_path: '/p/app.json', content: '{"expo":{}}' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── GraphQL ──────────────────────────────────────────────────────────────

describe('security/graphql-no-introspection-in-prod', () => {
  it('warns on introspection:true without env guard', async () => {
    const r = await graphqlNoIntrospectionInProd.check(
      ctx({
        toolInput: {
          file_path: '/p/src/server.ts',
          content: 'new ApolloServer({ introspection: true });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when NODE_ENV gated', async () => {
    const r = await graphqlNoIntrospectionInProd.check(
      ctx({
        toolInput: {
          file_path: '/p/src/server.ts',
          content: 'new ApolloServer({ introspection: process.env.NODE_ENV !== "production" });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/graphql-depth-limit', () => {
  it('warns on ApolloServer without depth limit', async () => {
    const r = await graphqlDepthLimit.check(
      ctx({
        toolInput: { file_path: '/p/src/server.ts', content: 'new ApolloServer({ schema });' },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with depth limit', async () => {
    const r = await graphqlDepthLimit.check(
      ctx({
        toolInput: {
          file_path: '/p/src/server.ts',
          content: 'new ApolloServer({ schema, validationRules: [depthLimit(7)] });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/graphql-complexity-limit', () => {
  it('warns on ApolloServer without complexity limit', async () => {
    const r = await graphqlComplexityLimit.check(
      ctx({
        toolInput: { file_path: '/p/src/server.ts', content: 'createYoga({ schema });' },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with complexity plugin', async () => {
    const r = await graphqlComplexityLimit.check(
      ctx({
        toolInput: {
          file_path: '/p/src/server.ts',
          content: 'createYoga({ schema, plugins: [costAnalysis({ maximumCost: 1000 })] });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/graphql-resolver-input-validation', () => {
  it('warns on resolver passing args to exec', async () => {
    const r = await graphqlResolverInputValidation.check(
      ctx({
        toolInput: {
          file_path: '/p/src/resolvers/user.ts',
          content: 'const userResolver = { getUser: (parent, args, ctx) => db.exec(args.query) };',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when args are not in path', async () => {
    const r = await graphqlResolverInputValidation.check(
      ctx({
        toolInput: {
          file_path: '/p/src/lib/util.ts',
          content: 'const userResolver = { getUser: (parent, args, ctx) => db.exec(args.query) };',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── Deno ─────────────────────────────────────────────────────────────────

describe('security/deno-permissions-audit', () => {
  it('blocks deno run -A', async () => {
    const r = await denoPermissionsAudit.check(
      ctx({
        tool: 'Bash',
        toolInput: { command: 'deno run -A script.ts' },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes scoped permissions', async () => {
    const r = await denoPermissionsAudit.check(
      ctx({
        tool: 'Bash',
        toolInput: { command: 'deno run --allow-net=api.example.com script.ts' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/deno-import-map-pinning', () => {
  it('warns on unpinned jsr: specifier', async () => {
    const r = await denoImportMapPinning.check(
      ctx({
        toolInput: {
          file_path: '/p/deno.json',
          content: '{"imports":{"std":"jsr:@std/fs"}}',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes pinned version', async () => {
    const r = await denoImportMapPinning.check(
      ctx({
        toolInput: {
          file_path: '/p/deno.json',
          content: '{"imports":{"std":"jsr:@std/fs@^1.0.0"}}',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/deno-no-eval-ffi', () => {
  it('blocks Deno.dlopen', async () => {
    const r = await denoNoEvalFfi.check(
      ctx({
        toolInput: {
          file_path: '/p/src/x.ts',
          content: 'const lib = Deno.dlopen("./lib.so", {});',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes benign code', async () => {
    const r = await denoNoEvalFfi.check(
      ctx({
        toolInput: { file_path: '/p/src/x.ts', content: 'const x = JSON.parse(text);' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── gRPC ─────────────────────────────────────────────────────────────────

describe('security/grpc-tls-required', () => {
  it('warns on createInsecure()', async () => {
    const r = await grpcTlsRequired.check(
      ctx({
        toolInput: {
          file_path: '/p/server.ts',
          content: 'server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createInsecure());',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes TLS credentials', async () => {
    const r = await grpcTlsRequired.check(
      ctx({
        toolInput: {
          file_path: '/p/server.ts',
          content:
            'server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createSsl(rootCert, keyCert));',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/grpc-auth-interceptor', () => {
  it('warns on new Server() without interceptor', async () => {
    const r = await grpcAuthInterceptor.check(
      ctx({
        toolInput: {
          file_path: '/p/server.ts',
          content: 'const server = new grpc.Server(); server.addService(svc, impl);',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with interceptor', async () => {
    const r = await grpcAuthInterceptor.check(
      ctx({
        toolInput: {
          file_path: '/p/server.ts',
          content: 'const server = new grpc.Server({ interceptors: [authMiddleware] });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/grpc-max-message-size', () => {
  it('warns on new Server() without max message size', async () => {
    const r = await grpcMaxMessageSize.check(
      ctx({
        toolInput: { file_path: '/p/server.ts', content: 'const server = new grpc.Server();' },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with max_receive_message_length', async () => {
    const r = await grpcMaxMessageSize.check(
      ctx({
        toolInput: {
          file_path: '/p/server.ts',
          content:
            'const server = new grpc.Server({ "grpc.max_receive_message_length": 4194304 });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/grpc-deadline-propagation', () => {
  it('warns on gRPC client call without deadline', async () => {
    const r = await grpcDeadlinePropagation.check(
      ctx({
        toolInput: {
          file_path: '/p/client.ts',
          content: 'userClient.getUser({ id: 1 }, (err, resp) => {});',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with deadline option', async () => {
    const r = await grpcDeadlinePropagation.check(
      ctx({
        toolInput: {
          file_path: '/p/client.ts',
          content: 'userClient.getUser({ id: 1 }, { deadline: Date.now() + 5000 }, cb);',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── Rails ────────────────────────────────────────────────────────────────

describe('security/rails-mass-assignment-strong-params', () => {
  it('warns on raw params.create', async () => {
    const r = await railsMassAssignmentStrongParams.check(
      ctx({
        toolInput: {
          file_path: '/p/app/controllers/users_controller.rb',
          content:
            'class UsersController < ApplicationController\n  def create\n    User.create(params[:user])\n  end\nend',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with permit()', async () => {
    const r = await railsMassAssignmentStrongParams.check(
      ctx({
        toolInput: {
          file_path: '/p/app/controllers/users_controller.rb',
          content:
            'class UsersController < ApplicationController\n  def create\n    User.create(params.require(:user).permit(:name))\n  end\nend',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/rails-brakeman-required', () => {
  it('warns when Gemfile has rails but no brakeman', async () => {
    writeFileSync(join(tmp, 'Gemfile'), 'gem "rails"\n');
    const r = await railsBrakemanRequired.check(
      ctx({
        toolInput: { file_path: join(tmp, 'Gemfile'), content: 'gem "rails"\n' },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when brakeman is present', async () => {
    writeFileSync(join(tmp, 'Gemfile'), 'gem "rails"\ngem "brakeman"\n');
    const r = await railsBrakemanRequired.check(
      ctx({
        toolInput: { file_path: join(tmp, 'Gemfile'), content: 'gem "rails"\ngem "brakeman"\n' },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/rails-csp-default-deny', () => {
  it('warns on :unsafe_inline', async () => {
    const r = await railsCspDefaultDeny.check(
      ctx({
        toolInput: {
          file_path: '/p/config/initializers/content_security_policy.rb',
          content:
            'Rails.application.config.content_security_policy do |p| p.script_src :self, :unsafe_inline end',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes without unsafe directives', async () => {
    const r = await railsCspDefaultDeny.check(
      ctx({
        toolInput: {
          file_path: '/p/config/initializers/content_security_policy.rb',
          content: 'Rails.application.config.content_security_policy do |p| p.script_src :self end',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/rails-encrypted-attr-on-pii', () => {
  it('warns on PII attr without encrypts', async () => {
    const r = await railsEncryptedAttrOnPii.check(
      ctx({
        toolInput: {
          file_path: '/p/app/models/user.rb',
          content:
            'class User < ApplicationRecord\n  # has :ssn column\n  validates :ssn, presence: true\nend',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with encrypts declaration', async () => {
    const r = await railsEncryptedAttrOnPii.check(
      ctx({
        toolInput: {
          file_path: '/p/app/models/user.rb',
          content:
            'class User < ApplicationRecord\n  encrypts :ssn\n  validates :ssn, presence: true\nend',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});
