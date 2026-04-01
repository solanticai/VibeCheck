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
};
