import { buildOpenApiSpec } from './openapi.js';

/**
 * HTTP webhook adapter.
 *
 * This adapter is intentionally not registered under the core `Adapter`
 * interface (which is keyed on `AgentType` and targets Node hook files).
 * Instead it exposes two artefacts:
 *
 *   1. `buildOpenApiSpec()` — an OpenAPI 3.0.3 JSON spec describing the
 *      /hook/:event endpoint contract.
 *   2. `startWebhookServer()` (see `./server.ts`) — a local HTTP server
 *      that evaluates VGuard rules against JSON payloads.
 *
 * Consumers in Python, Rust, Go, etc. generate a typed client from the
 * OpenAPI spec and POST to the server. This unlocks VGuard for any agent
 * toolchain that speaks HTTP.
 */
export function generateOpenApiArtefact(): {
  path: string;
  content: string;
  mergeStrategy: 'overwrite';
} {
  return {
    path: '.vguard/webhook/openapi.json',
    content: buildOpenApiSpec(),
    mergeStrategy: 'overwrite',
  };
}

export { buildOpenApiSpec } from './openapi.js';
export { startWebhookServer } from './server.js';
export type { WebhookServerOptions } from './server.js';
