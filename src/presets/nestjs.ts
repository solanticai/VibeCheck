import type { Preset } from '../types.js';

export const nestjs: Preset = {
  id: 'nestjs',
  name: 'NestJS',
  description: 'NestJS conventions: controller guards, helmet, throttler, class-validator DTOs.',
  version: '1.0.0',
  rules: {
    'security/nestjs-require-guards': true,
    'security/nestjs-helmet-middleware': true,
    'security/nestjs-throttler-configured': true,
    'security/nestjs-class-validator-dtos': true,
    'security/sql-injection': true,
    'security/secret-detection': true,
    'quality/error-handling': true,
  },
};
