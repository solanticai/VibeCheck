/**
 * Emit an OpenAPI 3.0.3 spec describing the VGuard webhook endpoint.
 * Consumers in Python / Rust / Go can generate a typed client from it.
 */
export function buildOpenApiSpec(): string {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'VGuard Webhook API',
      description:
        'Language-agnostic hook enforcement for AI coding agents. POST a HookPayload to /hook/:event and receive an {allowed, reason} response.',
      version: '1.0.0',
    },
    servers: [{ url: 'http://localhost:7321', description: 'local VGuard webhook server' }],
    paths: {
      '/hook/{event}': {
        post: {
          operationId: 'runHook',
          summary: 'Evaluate VGuard rules for a single tool-use event.',
          parameters: [
            {
              name: 'event',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: [
                  'PreToolUse',
                  'PostToolUse',
                  'Stop',
                  'SessionStart',
                  'SessionEnd',
                  'UserPromptSubmit',
                  'Notification',
                  'PreCompact',
                ],
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HookPayload' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Rule evaluation complete',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HookResponse' },
                },
              },
            },
            '400': { description: 'Malformed payload' },
            '500': { description: 'Internal error (fail-open: caller should not block)' },
          },
        },
      },
      '/healthz': {
        get: {
          operationId: 'healthz',
          summary: 'Liveness probe.',
          responses: { '200': { description: 'OK' } },
        },
      },
    },
    components: {
      schemas: {
        HookPayload: {
          type: 'object',
          required: ['tool', 'toolInput'],
          properties: {
            tool: { type: 'string', example: 'Bash' },
            toolInput: {
              type: 'object',
              additionalProperties: true,
              example: { command: 'git push --force' },
            },
            sessionId: { type: 'string' },
            projectRoot: { type: 'string', description: 'Absolute path to the consumer repo.' },
          },
        },
        HookResponse: {
          type: 'object',
          required: ['allowed'],
          properties: {
            allowed: { type: 'boolean' },
            reason: { type: 'string' },
            ruleId: { type: 'string' },
            warnings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ruleId: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };
  return JSON.stringify(spec, null, 2);
}
