import type { CDNRule, EdgePlan, EdgePlanVersion } from "@/shared-types";

export const DEFAULT_RULES: CDNRule[] = [
  {
    id: "seed-cache-images",
    type: "cache",
    path: "/img/*",
    ttl: 86_400,
    description: "Cache image assets for 24 hours."
  },
  {
    id: "seed-cache-fonts",
    type: "cache",
    path: "/fonts/*",
    ttl: 604_800,
    description: "Keep web fonts hot in cache for 7 days."
  },
  {
    id: "seed-cache-api",
    type: "cache",
    path: "/api/cacheable/*",
    ttl: 120,
    description: "Short-term caching for idempotent API responses."
  },
  {
    id: "seed-header-cache-control",
    type: "header",
    action: "add",
    name: "Cache-Control",
    value: "public, max-age=604800, immutable",
    description: "Ensure hashed static assets advertise long-lived caching."
  },
  {
    id: "seed-header-hsts",
    type: "header",
    action: "add",
    name: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
    description: "Enforce TLS across the zone."
  },
  {
    id: "seed-header-remove-server",
    type: "header",
    action: "remove",
    name: "Server",
    description: "Strip origin server disclosure headers."
  },
  {
    id: "seed-route-spa-fallback",
    type: "route",
    from: "/app/*",
    to: "/app/index.html",
    ruleType: "rewrite",
    description: "SPA fallback to index.html for nested routes."
  },
  {
    id: "seed-route-legacy-redirect",
    type: "route",
    from: "/legacy",
    to: "https://example.com/new-home",
    ruleType: "redirect",
    description: "Redirect legacy landing page to new marketing site."
  },
  {
    id: "seed-access-internal-api",
    type: "access",
    allow: ["10.0.0.0/8", "192.168.0.0/16"],
    deny: [],
    description: "Allow only private network clients to hit /internal APIs."
  },
  {
    id: "seed-access-block-bad-actors",
    type: "access",
    allow: [],
    deny: ["203.0.113.0/24", "198.51.100.42"],
    description: "Block known abusive ranges outright."
  },
  {
    id: "seed-performance-compression",
    type: "performance",
    optimization: "compression",
    enabled: true,
    description: "Force gzip/brotli compression for textual assets."
  },
  {
    id: "seed-performance-minification",
    type: "performance",
    optimization: "minification",
    enabled: true,
    description: "Minify HTML, CSS, and JS responses on the fly."
  },
  {
    id: "seed-performance-lazy-loading",
    type: "performance",
    optimization: "lazy-loading",
    enabled: true,
    description: "Defer offscreen media loading for landing pages."
  },
  {
    id: "seed-image-product",
    type: "image",
    path: "/products/*",
    quality: 82,
    format: "webp",
    width: 1200,
    description: "Serve responsive product hero images."
  },
  {
    id: "seed-image-thumbnails",
    type: "image",
    path: "/products/thumbnails/*",
    quality: 70,
    format: "auto",
    width: 320,
    height: 320,
    description: "Optimize product thumbnails for gallery view."
  },
  {
    id: "seed-rate-limit-public-api",
    type: "rate-limit",
    path: "/api/public/*",
    requestsPerMinute: 600,
    burst: 100,
    action: "challenge",
    description: "Throttle anonymous API access to manageable levels."
  },
  {
    id: "seed-rate-limit-login",
    type: "rate-limit",
    path: "/account/login",
    requestsPerMinute: 60,
    burst: 20,
    action: "block",
    description: "Protect the login endpoint against credential stuffing."
  },
  {
    id: "seed-bot-protection",
    type: "bot-protection",
    mode: "managed-challenge",
    sensitivity: "medium",
    description: "Step-up challenge suspicious traffic."
  },
  {
    id: "seed-geo-routing-checkout",
    type: "geo-routing",
    from: "/checkout/*",
    toEU: "https://eu.example.com",
    toUS: "https://us.example.com",
    toAPAC: "https://apac.example.com",
    fallback: "https://global.example.com",
    description: "Send checkout traffic to the closest commerce origin."
  },
  {
    id: "seed-security-headers",
    type: "security",
    csp: "default-src 'self'; img-src 'self' https://cdn.example.com; script-src 'self' 'unsafe-inline'",
    hstsMaxAge: 31_536_000,
    xfo: "SAMEORIGIN",
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: "geolocation=()",
    description: "Apply security header baseline."
  },
  {
    id: "seed-canary-api",
    type: "canary",
    path: "/api/*",
    primaryOrigin: "origin-api-v1",
    canaryOrigin: "origin-api-v2",
    percentage: 0.08,
    stickyBy: "cookie",
    metricGuardrail: {
      metric: "error_rate",
      operator: "lt",
      threshold: 0.03
    },
    description: "Dial 8% of API traffic to the new stack with guardrails."
  },
  {
    id: "seed-banner-maintenance",
    type: "banner",
    path: "/account/*",
    message: "Account maintenance scheduled 00:00-01:00 UTC.",
    style: { tone: "warning", theme: "dark" },
    schedule: {
      start: "2025-02-01T00:00:00.000Z",
      end: "2025-02-01T01:00:00.000Z",
      timezone: "UTC"
    },
    audience: { segment: "logged-in" },
    description: "Warn signed-in customers about the maintenance window."
  },
  {
    id: "seed-origin-shield",
    type: "origin-shield",
    origins: ["primary-origin", "backup-origin"],
    tieredCaching: "regional",
    healthcheck: {
      path: "/healthz",
      intervalSeconds: 60,
      timeoutMs: 2000
    },
    description: "Enable tiered caching and active origin health probes."
  },
  {
    id: "seed-transform-html-badge",
    type: "transform",
    path: "/",
    phase: "response",
    action: {
      kind: "html-inject",
      position: "body-end",
      markup: '<div class="edge-badge">Served by Edge Composer</div>'
    },
    description: "Inject a lightweight status badge in the footer."
  },
  {
    id: "seed-transform-request-header",
    type: "transform",
    path: "/api/*",
    phase: "request",
    action: {
      kind: "header",
      operation: "set",
      header: "cf-edge-composer",
      value: "v1"
    },
    description: "Tag upstream API requests for observability."
  }
];

export function createDefaultPlanVersion(): EdgePlanVersion {
  const timestamp = new Date().toISOString();
  const rules = DEFAULT_RULES.map(
    (rule) => JSON.parse(JSON.stringify(rule)) as CDNRule
  );
  const plan: EdgePlan = {
    id: "seed-plan",
    rules,
    createdAt: timestamp,
    summary:
      "Baseline CDN controls: caching, routing, guardrails, and runtime transforms applied."
  };
  return {
    id: "seed-plan",
    plan,
    promotedAt: timestamp,
    promotedBy: "system",
    description: "Seed plan generated for new environments"
  };
}

export function cloneDefaultRules(): CDNRule[] {
  return DEFAULT_RULES.map(
    (rule) => JSON.parse(JSON.stringify(rule)) as CDNRule
  );
}
