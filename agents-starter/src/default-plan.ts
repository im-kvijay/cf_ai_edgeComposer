import type { Rule, Plan, PlanVersion } from './types';

export const DEFAULT_RULES: Rule[] = [
  {
    id: 'seed-cache-images',
    type: 'cache',
    path: '/img/*',
    ttl: 86_400,
    description: 'Cache image assets for 24 hours.'
  },
  {
    id: 'seed-cache-fonts',
    type: 'cache',
    path: '/fonts/*',
    ttl: 604_800,
    description: 'Keep web fonts hot in cache for 7 days.'
  },
  {
    id: 'seed-header-hsts',
    type: 'header',
    action: 'add',
    name: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
    description: 'Enforce TLS across the zone.'
  },
  {
    id: 'seed-performance-compression',
    type: 'performance',
    optimization: 'compression',
    enabled: true,
    description: 'Force gzip/brotli compression for textual assets.'
  },
  {
    id: 'seed-rate-limit-public-api',
    type: 'rate-limit',
    path: '/api/public/*',
    requestsPerMinute: 600,
    burst: 100,
    action: 'challenge',
    description: 'Throttle anonymous API access to manageable levels.'
  },
  {
    id: 'seed-security-headers',
    type: 'security',
    hstsMaxAge: 31_536_000,
    xfo: 'SAMEORIGIN',
    referrerPolicy: 'strict-origin-when-cross-origin',
    description: 'Apply security header baseline.'
  }
];

export function createDefaultPlanVersion(): PlanVersion {
  const timestamp = new Date().toISOString();
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  const plan: Plan = {
    id: 'seed-plan',
    rules,
    createdAt: timestamp,
    summary: 'Baseline CDN controls: caching, security headers, and rate limiting.'
  };
  return {
    id: 'seed-plan',
    plan,
    promotedAt: timestamp,
    promotedBy: 'system',
    description: 'Seed plan generated for new environments'
  };
}

export function cloneDefaultRules(): Rule[] {
  return DEFAULT_RULES.map((rule) => ({ ...rule }));
}

// Re-export types for backwards compatibility
export type { Rule as CDNRule, Plan as EdgePlan, PlanVersion as EdgePlanVersion } from './types';
