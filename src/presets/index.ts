import { registerPreset } from '../config/presets.js';
import { nextjs15 } from './nextjs-15.js';
import { typescriptStrict } from './typescript-strict.js';
import { react19 } from './react-19.js';
import { supabase } from './supabase.js';
import { tailwind } from './tailwind.js';
import { django } from './django.js';
import { fastapi } from './fastapi.js';
import { laravel } from './laravel.js';
import { wordpress } from './wordpress.js';
import { reactNative } from './react-native.js';
import { astro } from './astro.js';
import { sveltekit } from './sveltekit.js';
import { pythonStrict } from './python-strict.js';
import { go } from './go.js';
import { vue } from './vue.js';
import { remix } from './remix.js';
import { prisma } from './prisma.js';
import { express } from './express.js';
import { dockerfile } from './dockerfile.js';
import { langchain } from './langchain.js';
import { drizzle } from './drizzle.js';
import { terraform } from './terraform.js';
import { mcpServer } from './mcp-server.js';
import { kubernetesManifests } from './kubernetes-manifests.js';
import { bun } from './bun.js';
import { mongodb } from './mongodb.js';
import { nestjs } from './nestjs.js';
import { nuxt } from './nuxt.js';
import { trpc } from './trpc.js';
import { zodValidation } from './zod-validation.js';
import { expo } from './expo.js';
import { graphql } from './graphql.js';
import { deno } from './deno.js';
import { grpc } from './grpc.js';
import { rails } from './rails.js';
import { redis } from './redis.js';
import { phoenixElixir } from './phoenix-elixir.js';

/** All built-in presets */
export const allBuiltinPresets = [
  nextjs15,
  typescriptStrict,
  react19,
  supabase,
  tailwind,
  django,
  fastapi,
  laravel,
  wordpress,
  reactNative,
  astro,
  sveltekit,
  pythonStrict,
  go,
  vue,
  remix,
  prisma,
  express,
  dockerfile,
  langchain,
  drizzle,
  terraform,
  mcpServer,
  kubernetesManifests,
  bun,
  mongodb,
  nestjs,
  nuxt,
  trpc,
  zodValidation,
  expo,
  graphql,
  deno,
  grpc,
  rails,
  redis,
  phoenixElixir,
];

/** Register all built-in presets */
export function registerBuiltinPresets(): void {
  for (const preset of allBuiltinPresets) {
    registerPreset(preset);
  }
}

// Auto-register on import
registerBuiltinPresets();

export {
  nextjs15,
  typescriptStrict,
  react19,
  supabase,
  tailwind,
  django,
  fastapi,
  laravel,
  wordpress,
  reactNative,
  astro,
  sveltekit,
  pythonStrict,
  go,
  vue,
  remix,
  prisma,
  express,
  dockerfile,
  langchain,
  drizzle,
  terraform,
  mcpServer,
  kubernetesManifests,
  bun,
  mongodb,
  nestjs,
  nuxt,
  trpc,
  zodValidation,
  expo,
  graphql,
  deno,
  grpc,
  rails,
  redis,
  phoenixElixir,
};
