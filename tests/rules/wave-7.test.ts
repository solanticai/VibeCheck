import { describe, it, expect } from 'vitest';
import type { HookContext, ResolvedConfig } from '../../src/types.js';
import { nestjsRequireGuards } from '../../src/rules/security/nestjs-require-guards.js';
import { nestjsHelmetMiddleware } from '../../src/rules/security/nestjs-helmet-middleware.js';
import { nestjsThrottlerConfigured } from '../../src/rules/security/nestjs-throttler-configured.js';
import { nestjsClassValidatorDtos } from '../../src/rules/security/nestjs-class-validator-dtos.js';
import { nuxtEnvVarPrefix } from '../../src/rules/security/nuxt-env-var-prefix.js';
import { nuxtSecurityHeaders } from '../../src/rules/security/nuxt-security-headers.js';
import { nuxtUseStatePerRequest } from '../../src/rules/quality/nuxt-usestate-per-request.js';
import { trpcRequireInputValidation } from '../../src/rules/security/trpc-require-input-validation.js';
import { trpcAuthMiddleware } from '../../src/rules/security/trpc-auth-middleware.js';
import { trpcNoLeakedServerOnly } from '../../src/rules/security/trpc-no-leaked-server-only.js';
import { zodServerActionInput } from '../../src/rules/security/zod-server-action-input.js';
import { zodNoAnySchema } from '../../src/rules/quality/zod-no-any-schema.js';
import { zodRequireStripOrStrict } from '../../src/rules/quality/zod-require-strip-or-strict.js';

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
      repoRoot: '/p',
      unpushedCount: 0,
      hasRemote: false,
    },
    ...overrides,
  };
}

// ─── NestJS ───────────────────────────────────────────────────────────────

describe('security/nestjs-require-guards', () => {
  it('warns on controller without guards', async () => {
    const r = await nestjsRequireGuards.check(
      ctx({
        toolInput: {
          file_path: '/p/src/users/users.controller.ts',
          content: '@Controller("users") export class UsersController { @Get() list() {} }',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with @UseGuards', async () => {
    const r = await nestjsRequireGuards.check(
      ctx({
        toolInput: {
          file_path: '/p/src/users/users.controller.ts',
          content:
            '@UseGuards(AuthGuard)\n@Controller("users") export class UsersController { @Get() list() {} }',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/nestjs-helmet-middleware', () => {
  it('warns when main.ts bootstraps without helmet', async () => {
    const r = await nestjsHelmetMiddleware.check(
      ctx({
        toolInput: {
          file_path: '/p/src/main.ts',
          content: 'const app = await NestFactory.create(AppModule); await app.listen(3000);',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with helmet applied', async () => {
    const r = await nestjsHelmetMiddleware.check(
      ctx({
        toolInput: {
          file_path: '/p/src/main.ts',
          content:
            'const app = await NestFactory.create(AppModule); app.use(helmet()); await app.listen(3000);',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/nestjs-throttler-configured', () => {
  it('warns when AppModule lacks ThrottlerModule', async () => {
    const r = await nestjsThrottlerConfigured.check(
      ctx({
        toolInput: {
          file_path: '/p/src/app.module.ts',
          content: '@Module({ imports: [ConfigModule.forRoot()] }) export class AppModule {}',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with ThrottlerModule imported', async () => {
    const r = await nestjsThrottlerConfigured.check(
      ctx({
        toolInput: {
          file_path: '/p/src/app.module.ts',
          content: '@Module({ imports: [ThrottlerModule.forRoot({})] }) export class AppModule {}',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/nestjs-class-validator-dtos', () => {
  it('warns on DTO without validators', async () => {
    const r = await nestjsClassValidatorDtos.check(
      ctx({
        toolInput: {
          file_path: '/p/src/users/create-user.dto.ts',
          content: 'export class CreateUserDto { email: string; name: string; }',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with class-validator decorators', async () => {
    const r = await nestjsClassValidatorDtos.check(
      ctx({
        toolInput: {
          file_path: '/p/src/users/create-user.dto.ts',
          content:
            'export class CreateUserDto { @IsEmail() email: string; @IsString() name: string; }',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── Nuxt ─────────────────────────────────────────────────────────────────

describe('security/nuxt-env-var-prefix', () => {
  it('blocks non-NUXT_PUBLIC env in pages/', async () => {
    const r = await nuxtEnvVarPrefix.check(
      ctx({
        toolInput: {
          file_path: '/p/pages/index.vue',
          content: '<script setup>const key = process.env.STRIPE_SECRET_KEY;</script>',
        },
      }),
    );
    expect(r.status).toBe('block');
  });
  it('passes NUXT_PUBLIC vars', async () => {
    const r = await nuxtEnvVarPrefix.check(
      ctx({
        toolInput: {
          file_path: '/p/pages/index.vue',
          content: '<script setup>const url = process.env.NUXT_PUBLIC_API_URL;</script>',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/nuxt-security-headers', () => {
  it('warns when nuxt.config.ts lacks nuxt-security', async () => {
    const r = await nuxtSecurityHeaders.check(
      ctx({
        toolInput: {
          file_path: '/p/nuxt.config.ts',
          content: 'export default defineNuxtConfig({ modules: ["@nuxtjs/tailwindcss"] });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with nuxt-security module', async () => {
    const r = await nuxtSecurityHeaders.check(
      ctx({
        toolInput: {
          file_path: '/p/nuxt.config.ts',
          content: 'export default defineNuxtConfig({ modules: ["nuxt-security"] });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('quality/nuxt-usestate-per-request', () => {
  it('warns on module-level Map cache in composable', async () => {
    const r = await nuxtUseStatePerRequest.check(
      ctx({
        toolInput: {
          file_path: '/p/composables/useAuth.ts',
          content: 'const userCache = new Map();',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes outside composables/', async () => {
    const r = await nuxtUseStatePerRequest.check(
      ctx({
        toolInput: {
          file_path: '/p/src/lib.ts',
          content: 'const userCache = new Map();',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── tRPC ─────────────────────────────────────────────────────────────────

describe('security/trpc-require-input-validation', () => {
  it('warns on mutation without .input()', async () => {
    const r = await trpcRequireInputValidation.check(
      ctx({
        toolInput: {
          file_path: '/p/server/routers/user.ts',
          content:
            'export const userRouter = router({ create: publicProcedure.mutation(({ input }) => {}) });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with .input()', async () => {
    const r = await trpcRequireInputValidation.check(
      ctx({
        toolInput: {
          file_path: '/p/server/routers/user.ts',
          content:
            'export const userRouter = router({ create: publicProcedure.input(z.object({})).mutation(() => {}) });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/trpc-auth-middleware', () => {
  it('warns on publicProcedure.mutation', async () => {
    const r = await trpcAuthMiddleware.check(
      ctx({
        toolInput: {
          file_path: '/p/server/router.ts',
          content: 'deleteUser: publicProcedure.mutation(({ input }) => {})',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes on protectedProcedure.mutation', async () => {
    const r = await trpcAuthMiddleware.check(
      ctx({
        toolInput: {
          file_path: '/p/server/router.ts',
          content: 'deleteUser: protectedProcedure.mutation(({ input }) => {})',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('security/trpc-no-leaked-server-only', () => {
  it('warns when client imports server router', async () => {
    const r = await trpcNoLeakedServerOnly.check(
      ctx({
        toolInput: {
          file_path: '/p/src/components/UserList.tsx',
          content: 'import { userRouter } from "../server/routers/user";',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes type-only import', async () => {
    const r = await trpcNoLeakedServerOnly.check(
      ctx({
        toolInput: {
          file_path: '/p/src/components/UserList.tsx',
          content: 'import type { AppRouter } from "@/trpc/types";',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

// ─── Zod ──────────────────────────────────────────────────────────────────

describe('security/zod-server-action-input', () => {
  it('warns on server action with FormData and no Zod', async () => {
    const r = await zodServerActionInput.check(
      ctx({
        toolInput: {
          file_path: '/p/app/actions.ts',
          content: '"use server";\nexport async function save(form: FormData) { /* ... */ }',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes when Zod parse is present', async () => {
    const r = await zodServerActionInput.check(
      ctx({
        toolInput: {
          file_path: '/p/app/actions.ts',
          content:
            '"use server";\nexport async function save(form: FormData) { const d = schema.safeParse(Object.fromEntries(form)); }',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('quality/zod-no-any-schema', () => {
  it('warns on z.any()', async () => {
    const r = await zodNoAnySchema.check(
      ctx({
        toolInput: {
          file_path: '/p/src/schema.ts',
          content: 'const s = z.object({ x: z.any() });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes typed schema', async () => {
    const r = await zodNoAnySchema.check(
      ctx({
        toolInput: {
          file_path: '/p/src/schema.ts',
          content: 'const s = z.object({ x: z.string() });',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});

describe('quality/zod-require-strip-or-strict', () => {
  it('warns on z.object without strict/strip', async () => {
    const r = await zodRequireStripOrStrict.check(
      ctx({
        toolInput: {
          file_path: '/p/src/schema.ts',
          content: 'const s = z.object({ email: z.string() });',
        },
      }),
    );
    expect(r.status).toBe('warn');
  });
  it('passes with .strict()', async () => {
    const r = await zodRequireStripOrStrict.check(
      ctx({
        toolInput: {
          file_path: '/p/src/schema.ts',
          content: 'const s = z.object({ email: z.string() }).strict();',
        },
      }),
    );
    expect(r.status).toBe('pass');
  });
});
