import { describe, it, expect } from 'vitest';
import { buildOpenApiSpec } from '../../src/adapters/http-webhook/openapi.js';

describe('http-webhook OpenAPI spec', () => {
  it('is valid JSON', () => {
    const raw = buildOpenApiSpec();
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('is an OpenAPI 3.0.3 document', () => {
    const spec = JSON.parse(buildOpenApiSpec()) as Record<string, unknown>;
    expect(spec.openapi).toBe('3.0.3');
  });

  it('declares /hook/{event} and /healthz paths', () => {
    const spec = JSON.parse(buildOpenApiSpec()) as {
      paths: Record<string, unknown>;
    };
    expect(spec.paths).toHaveProperty('/hook/{event}');
    expect(spec.paths).toHaveProperty('/healthz');
  });

  it('lists all core hook events in the path parameter enum', () => {
    const spec = JSON.parse(buildOpenApiSpec()) as {
      paths: { '/hook/{event}': { post: { parameters: Array<{ schema?: { enum?: string[] } }> } } };
    };
    const param = spec.paths['/hook/{event}'].post.parameters[0];
    const events = param.schema?.enum ?? [];
    expect(events).toContain('PreToolUse');
    expect(events).toContain('PostToolUse');
    expect(events).toContain('Stop');
  });

  it('describes the HookResponse schema', () => {
    const spec = JSON.parse(buildOpenApiSpec()) as {
      components: {
        schemas: { HookResponse: { required: string[]; properties: Record<string, unknown> } };
      };
    };
    const resp = spec.components.schemas.HookResponse;
    expect(resp.required).toContain('allowed');
    expect(resp.properties).toHaveProperty('warnings');
  });
});
