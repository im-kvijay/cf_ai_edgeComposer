import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";
import type {
  CDNRule,
  CacheRule,
  ResearchNote,
  ToolTraceEntry,
  ImageRule,
  RateLimitRule,
  BotProtectionRule,
  GeoRoutingRule,
  SecurityRule,
  CanaryRule,
  BannerRule,
  OriginShieldRule,
  TransformRule,
  TodoEntry
} from "@/shared-types";

const ID_SCHEMA = z.string().uuid().or(z.string().min(6));
const PATH_SCHEMA = z.string().min(1, "path is required");
const GUARDRAIL_SCHEMA = z.object({
  metric: z.enum(["latency", "error_rate", "cache_hit"]),
  operator: z.enum(["lt", "gt", "lte", "gte"]),
  threshold: z.number().positive()
});

const bannerScheduleSchema = z
  .object({
    start: z.string().optional(),
    end: z.string().optional(),
    timezone: z.string().optional()
  })
  .refine(
    ({ start, end }) => {
      if (start && end)
        return new Date(start).getTime() <= new Date(end).getTime();
      return true;
    },
    { message: "schedule start must be before end" }
  );

const bannerAudienceSchema = z.object({
  segment: z.enum(["logged-in", "guest", "beta", "maintenance"]).optional(),
  geo: z.array(z.string()).max(10).optional()
});

const SUMMARY_FOCUS = [
  "cache",
  "routing",
  "security",
  "performance",
  "runtime"
] as const;
type SummaryFocus = (typeof SUMMARY_FOCUS)[number];

const transformActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("header"),
    operation: z.enum(["set", "remove", "append"]),
    header: z.string(),
    value: z.string().optional()
  }),
  z.object({
    kind: z.literal("html-inject"),
    position: z.enum(["head-start", "head-end", "body-start", "body-end"]),
    markup: z.string().min(1)
  }),
  z.object({
    kind: z.literal("rewrite-url"),
    to: z.string().min(1)
  })
]);

const baseRuleSchemas = {
  cache: z.object({
    id: ID_SCHEMA,
    type: z.literal("cache"),
    path: PATH_SCHEMA,
    ttl: z.number().int().min(60).max(31_536_000),
    description: z.string().optional()
  }),
  header: z.object({
    id: ID_SCHEMA,
    type: z.literal("header"),
    action: z.enum(["add", "remove", "modify"]),
    name: z.string(),
    value: z.string().optional(),
    description: z.string().optional()
  }),
  route: z.object({
    id: ID_SCHEMA,
    type: z.literal("route"),
    from: PATH_SCHEMA,
    to: z.string().min(1),
    ruleType: z.enum(["redirect", "rewrite", "proxy"]),
    description: z.string().optional()
  }),
  access: z.object({
    id: ID_SCHEMA,
    type: z.literal("access"),
    allow: z.array(z.string()).default([]),
    deny: z.array(z.string()).default([]),
    description: z.string().optional()
  }),
  performance: z.object({
    id: ID_SCHEMA,
    type: z.literal("performance"),
    optimization: z.enum([
      "compression",
      "minification",
      "image-optimization",
      "lazy-loading"
    ]),
    enabled: z.boolean(),
    description: z.string().optional()
  }),
  image: z.object({
    id: ID_SCHEMA,
    type: z.literal("image"),
    path: PATH_SCHEMA,
    quality: z.number().min(1).max(100).optional(),
    format: z.enum(["auto", "webp", "avif", "jpeg"]).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    description: z.string().optional()
  }),
  "rate-limit": z.object({
    id: ID_SCHEMA,
    type: z.literal("rate-limit"),
    path: PATH_SCHEMA,
    requestsPerMinute: z.number().positive(),
    burst: z.number().positive().optional(),
    action: z.enum(["block", "challenge", "delay", "log"]),
    description: z.string().optional()
  }),
  "bot-protection": z.object({
    id: ID_SCHEMA,
    type: z.literal("bot-protection"),
    mode: z.enum(["off", "js-challenge", "managed-challenge", "block"]),
    sensitivity: z.enum(["low", "medium", "high"]).optional(),
    description: z.string().optional()
  }),
  "geo-routing": z.object({
    id: ID_SCHEMA,
    type: z.literal("geo-routing"),
    from: PATH_SCHEMA,
    toEU: z.string().optional(),
    toUS: z.string().optional(),
    toAPAC: z.string().optional(),
    fallback: z.string().optional(),
    description: z.string().optional()
  }),
  security: z.object({
    id: ID_SCHEMA,
    type: z.literal("security"),
    csp: z.string().optional(),
    hstsMaxAge: z.number().int().nonnegative().optional(),
    xfo: z.string().optional(),
    referrerPolicy: z.string().optional(),
    permissionsPolicy: z.string().optional(),
    description: z.string().optional()
  }),
  canary: z.object({
    id: ID_SCHEMA,
    type: z.literal("canary"),
    path: PATH_SCHEMA,
    primaryOrigin: z.string(),
    canaryOrigin: z.string(),
    percentage: z.number().min(0.01).max(0.5),
    stickyBy: z.enum(["cookie", "header", "ip", "session"]).optional(),
    metricGuardrail: GUARDRAIL_SCHEMA.optional(),
    description: z.string().optional()
  }),
  banner: z.object({
    id: ID_SCHEMA,
    type: z.literal("banner"),
    path: PATH_SCHEMA,
    message: z.string().min(1),
    style: z
      .object({
        tone: z
          .enum(["info", "success", "warning", "danger", "mint"])
          .optional(),
        theme: z.enum(["light", "dark", "auto"]).optional()
      })
      .optional(),
    schedule: bannerScheduleSchema.optional(),
    audience: bannerAudienceSchema.optional(),
    description: z.string().optional()
  }),
  "origin-shield": z.object({
    id: ID_SCHEMA,
    type: z.literal("origin-shield"),
    origins: z.array(z.string().min(1)).min(1),
    tieredCaching: z.enum(["smart", "regional", "off"]).optional(),
    healthcheck: z
      .object({
        path: z.string().min(1),
        intervalSeconds: z.number().positive().max(3600).optional(),
        timeoutMs: z.number().positive().max(10_000).optional()
      })
      .optional(),
    description: z.string().optional()
  }),
  transform: z.object({
    id: ID_SCHEMA,
    type: z.literal("transform"),
    path: PATH_SCHEMA,
    phase: z.enum(["request", "response"]),
    action: transformActionSchema,
    description: z.string().optional()
  })
} as const;

type RuleSchemaKey = keyof typeof baseRuleSchemas;

const RULE_VALIDATORS = baseRuleSchemas as Record<RuleSchemaKey, z.ZodTypeAny>;

const INPUT_SCHEMAS = {
  cache: baseRuleSchemas.cache.omit({ id: true, type: true }),
  header: baseRuleSchemas.header.omit({ id: true, type: true }),
  route: baseRuleSchemas.route.omit({ id: true, type: true }),
  access: baseRuleSchemas.access.omit({ id: true, type: true }),
  performance: baseRuleSchemas.performance.omit({ id: true, type: true }),
  image: baseRuleSchemas.image.omit({ id: true, type: true }),
  "rate-limit": baseRuleSchemas["rate-limit"].omit({ id: true, type: true }),
  "bot-protection": baseRuleSchemas["bot-protection"].omit({
    id: true,
    type: true
  }),
  "geo-routing": baseRuleSchemas["geo-routing"].omit({ id: true, type: true }),
  security: baseRuleSchemas.security.omit({ id: true, type: true }),
  canary: baseRuleSchemas.canary.omit({ id: true, type: true }),
  banner: baseRuleSchemas.banner.omit({ id: true, type: true }),
  "origin-shield": baseRuleSchemas["origin-shield"].omit({
    id: true,
    type: true
  }),
  transform: baseRuleSchemas.transform.omit({ id: true, type: true })
} as const;

export function createCDNTools(
  plan: CDNRule[],
  trace?: ToolTraceEntry[],
  todos?: TodoEntry[],
  notes?: ResearchNote[]
) {
  // Record tool invocations in the trace so the UI can display inputs/outputs and failures.
  const record = (
    label: string,
    input: unknown,
    output: unknown,
    status: ToolTraceEntry["status"] = "success"
  ) => {
    try {
      trace?.push({
        id: crypto.randomUUID(),
        label,
        status,
        input,
        output,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      });
    } catch {}
  };

  // Generate a stable signature used when deduping rules (ignores the random rule id).
  const canonicalizeRule = (rule: CDNRule) => {
    const { id: _id, ...rest } = rule;

    switch (rule.type) {
      case "cache":
        return JSON.stringify({
          type: "cache",
          path: rule.path,
          ttl: rule.ttl,
          description: rule.description ?? ""
        });
      case "header":
        return JSON.stringify({
          type: "header",
          action: rule.action,
          name: rule.name.toLowerCase(),
          value: rule.value ?? "",
          description: rule.description ?? ""
        });
      case "route":
        return JSON.stringify({
          type: "route",
          from: rule.from,
          to: rule.to,
          ruleType: rule.ruleType
        });
      case "access":
        return JSON.stringify({
          type: "access",
          allow: [...rule.allow].sort(),
          deny: [...rule.deny].sort()
        });
      case "performance":
        return JSON.stringify({
          type: "performance",
          optimization: rule.optimization,
          enabled: rule.enabled
        });
      case "image":
        return JSON.stringify({
          type: "image",
          path: rule.path,
          quality: rule.quality ?? "",
          format: rule.format ?? "",
          width: rule.width ?? "",
          height: rule.height ?? ""
        });
      case "rate-limit":
        return JSON.stringify({
          type: "rate-limit",
          path: rule.path,
          rpm: rule.requestsPerMinute,
          burst: rule.burst ?? "",
          action: rule.action
        });
      case "bot-protection":
        return JSON.stringify({
          type: "bot-protection",
          mode: rule.mode,
          sensitivity: rule.sensitivity ?? ""
        });
      case "geo-routing":
        return JSON.stringify({
          type: "geo-routing",
          from: rule.from,
          map: {
            eu: rule.toEU ?? "",
            us: rule.toUS ?? "",
            apac: rule.toAPAC ?? "",
            fallback: rule.fallback ?? ""
          }
        });
      case "security":
        return JSON.stringify({
          type: "security",
          csp: rule.csp ?? "",
          hsts: rule.hstsMaxAge ?? "",
          xfo: rule.xfo ?? "",
          referrer: rule.referrerPolicy ?? "",
          permissions: rule.permissionsPolicy ?? ""
        });
      case "canary":
        return JSON.stringify({
          type: "canary",
          path: rule.path,
          primaryOrigin: rule.primaryOrigin,
          canaryOrigin: rule.canaryOrigin,
          pct: Number(rule.percentage.toFixed(4)),
          sticky: rule.stickyBy ?? "",
          guardrail: rule.metricGuardrail
            ? {
                metric: rule.metricGuardrail.metric,
                operator: rule.metricGuardrail.operator,
                threshold: Number(rule.metricGuardrail.threshold.toFixed(4))
              }
            : null
        });
      case "banner":
        return JSON.stringify({
          type: "banner",
          path: rule.path,
          message: rule.message.trim(),
          style: rule.style ?? {},
          schedule: rule.schedule ?? {},
          audience: rule.audience ?? {}
        });
      case "origin-shield":
        return JSON.stringify({
          type: "origin-shield",
          origins: [...rule.origins].sort(),
          tieredCaching: rule.tieredCaching ?? "",
          healthcheck: rule.healthcheck ?? {}
        });
      case "transform":
        return JSON.stringify({
          type: "transform",
          path: rule.path,
          phase: rule.phase,
          action: rule.action
        });
      default:
        return JSON.stringify(rest);
    }
  };
  const addCacheRule = tool({
    description: "Add a cache rule (provide path glob and TTL in seconds)",
    inputSchema: INPUT_SCHEMAS.cache,
    execute: async ({ path, ttl, description }) => {
      const rule: CDNRule = {
        id: crypto.randomUUID(),
        type: "cache",
        path,
        ttl,
        description
      };
      plan.push(rule);
      record("addCacheRule", { path, ttl, description }, rule);
      return rule;
    }
  });

  const addHeaderRule = tool({
    description: "Add a header rule (add/remove/modify)",
    inputSchema: INPUT_SCHEMAS.header,
    execute: async ({ action, name, value, description }) => {
      const rule: CDNRule = {
        id: crypto.randomUUID(),
        type: "header",
        action,
        name,
        value,
        description
      };
      plan.push(rule);
      record("addHeaderRule", { action, name, value, description }, rule);
      return rule;
    }
  });

  const addRouteRule = tool({
    description: "Add a routing rule (redirect/rewrite/proxy)",
    inputSchema: INPUT_SCHEMAS.route,
    execute: async ({ from, to, ruleType, description }) => {
      const rule: CDNRule = {
        id: crypto.randomUUID(),
        type: "route",
        from,
        to,
        ruleType,
        description
      };
      plan.push(rule);
      record("addRouteRule", { from, to, ruleType, description }, rule);
      return rule;
    }
  });

  const addAccessRule = tool({
    description: "Add an access control rule (allow/deny lists)",
    inputSchema: INPUT_SCHEMAS.access,
    execute: async ({ allow, deny, description }) => {
      const rule: CDNRule = {
        id: crypto.randomUUID(),
        type: "access",
        allow,
        deny,
        description
      };
      plan.push(rule);
      record("addAccessRule", { allow, deny, description }, rule);
      return rule;
    }
  });

  const addPerformanceRule = tool({
    description: "Add a performance optimization rule",
    inputSchema: INPUT_SCHEMAS.performance,
    execute: async ({ optimization, enabled, description }) => {
      const rule: CDNRule = {
        id: crypto.randomUUID(),
        type: "performance",
        optimization,
        enabled,
        description
      };
      plan.push(rule);
      record(
        "addPerformanceRule",
        { optimization, enabled, description },
        rule
      );
      return rule;
    }
  });

  // Additional rule tools
  const addImageRule = tool({
    description: "Add an image optimization rule (quality/format/resize)",
    inputSchema: INPUT_SCHEMAS.image,
    execute: async ({ path, quality, format, width, height, description }) => {
      const rule: ImageRule = {
        id: crypto.randomUUID(),
        type: "image",
        path,
        quality,
        format,
        width,
        height,
        description
      };
      plan.push(rule);
      record(
        "addImageRule",
        { path, quality, format, width, height, description },
        rule
      );
      return rule;
    }
  });

  const addRateLimitRule = tool({
    description: "Add a rate limit rule (rpm, burst, action)",
    inputSchema: INPUT_SCHEMAS["rate-limit"],
    execute: async ({
      path,
      requestsPerMinute,
      burst,
      action,
      description
    }) => {
      const rule: RateLimitRule = {
        id: crypto.randomUUID(),
        type: "rate-limit",
        path,
        requestsPerMinute,
        burst,
        action,
        description
      };
      plan.push(rule);
      record(
        "addRateLimitRule",
        { path, requestsPerMinute, burst, action, description },
        rule
      );
      return rule;
    }
  });

  const addBotProtectionRule = tool({
    description: "Configure bot protection policy",
    inputSchema: INPUT_SCHEMAS["bot-protection"],
    execute: async ({ mode, sensitivity, description }) => {
      const rule: BotProtectionRule = {
        id: crypto.randomUUID(),
        type: "bot-protection",
        mode,
        sensitivity,
        description
      };
      plan.push(rule);
      record("addBotProtectionRule", { mode, sensitivity, description }, rule);
      return rule;
    }
  });

  const addGeoRoutingRule = tool({
    description: "Route requests by region (EU/US/APAC)",
    inputSchema: INPUT_SCHEMAS["geo-routing"],
    execute: async ({ from, toEU, toUS, toAPAC, fallback, description }) => {
      const rule: GeoRoutingRule = {
        id: crypto.randomUUID(),
        type: "geo-routing",
        from,
        toEU,
        toUS,
        toAPAC,
        fallback,
        description
      };
      plan.push(rule);
      record(
        "addGeoRoutingRule",
        { from, toEU, toUS, toAPAC, fallback, description },
        rule
      );
      return rule;
    }
  });

  const addSecurityRule = tool({
    description: "Add security headers (CSP/HSTS/XFO/etc)",
    inputSchema: INPUT_SCHEMAS.security,
    execute: async ({
      csp,
      hstsMaxAge,
      xfo,
      referrerPolicy,
      permissionsPolicy,
      description
    }) => {
      const rule: SecurityRule = {
        id: crypto.randomUUID(),
        type: "security",
        csp,
        hstsMaxAge,
        xfo,
        referrerPolicy,
        permissionsPolicy,
        description
      };
      plan.push(rule);
      record(
        "addSecurityRule",
        {
          csp,
          hstsMaxAge,
          xfo,
          referrerPolicy,
          permissionsPolicy,
          description
        },
        rule
      );
      return rule;
    }
  });

  const addCanaryRule = tool({
    description: "Safely split traffic between primary and canary origins",
    inputSchema: INPUT_SCHEMAS.canary,
    execute: async ({
      path,
      primaryOrigin,
      canaryOrigin,
      percentage,
      stickyBy,
      metricGuardrail,
      description
    }) => {
      const rule: CanaryRule = {
        id: crypto.randomUUID(),
        type: "canary",
        path,
        primaryOrigin,
        canaryOrigin,
        percentage,
        stickyBy,
        metricGuardrail: metricGuardrail
          ? {
              metric: metricGuardrail.metric,
              operator: metricGuardrail.operator,
              threshold: metricGuardrail.threshold
            }
          : undefined,
        description
      };
      plan.push(rule);
      record(
        "addCanaryRule",
        {
          path,
          primaryOrigin,
          canaryOrigin,
          percentage,
          stickyBy,
          metricGuardrail,
          description
        },
        rule
      );
      return rule;
    }
  });

  const addBannerRule = tool({
    description: "Inject a lightweight HTML banner with targeting and schedule",
    inputSchema: INPUT_SCHEMAS.banner,
    execute: async ({
      path,
      message,
      style,
      schedule,
      audience,
      description
    }) => {
      const rule: BannerRule = {
        id: crypto.randomUUID(),
        type: "banner",
        path,
        message,
        style,
        schedule,
        audience,
        description
      };
      plan.push(rule);
      record(
        "addBannerRule",
        { path, style, schedule, audience, description },
        rule
      );
      return rule;
    }
  });

  const addOriginShieldRule = tool({
    description: "Configure origin shielding and tiered caching",
    inputSchema: INPUT_SCHEMAS["origin-shield"],
    execute: async ({ origins, tieredCaching, healthcheck, description }) => {
      const rule: OriginShieldRule = {
        id: crypto.randomUUID(),
        type: "origin-shield",
        origins,
        tieredCaching,
        healthcheck: healthcheck
          ? {
              path: healthcheck.path,
              intervalSeconds: healthcheck.intervalSeconds,
              timeoutMs: healthcheck.timeoutMs
            }
          : undefined,
        description
      };
      plan.push(rule);
      record(
        "addOriginShieldRule",
        { origins, tieredCaching, healthcheck, description },
        rule
      );
      return rule;
    }
  });

  const addTransformRule = tool({
    description:
      "Add a request/response transform (headers, HTML injection, rewrite)",
    inputSchema: INPUT_SCHEMAS.transform,
    execute: async ({ path, phase, action, description }) => {
      const normalizedAction: TransformRule["action"] =
        action.kind === "header"
          ? {
              kind: "header",
              operation: action.operation,
              header: action.header,
              value: action.value
            }
          : action.kind === "html-inject"
            ? {
                kind: "html-inject",
                position: action.position,
                markup: action.markup
              }
            : { kind: "rewrite-url", to: action.to };

      const rule: TransformRule = {
        id: crypto.randomUUID(),
        type: "transform",
        path,
        phase,
        action: normalizedAction,
        description
      };
      plan.push(rule);
      record(
        "addTransformRule",
        { path, phase, action: normalizedAction, description },
        rule
      );
      return rule;
    }
  });

  const addResearchNote = tool({
    description:
      "Add a research note that supports the chosen optimizations (not for greetings)",
    inputSchema: z.object({ note: z.string() }),
    execute: async ({ note }) => {
      const entry: ResearchNote = { id: crypto.randomUUID(), note };
      notes?.push(entry);
      record("addResearchNote", { note }, entry);
      return entry;
    }
  });

  // Plan management utilities
  const listRules = tool({
    description: "List all current rules in the working plan",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const snapshot = plan.map((rule) => ({ ...rule }));
      record("listRules", {}, snapshot);
      return snapshot;
    }
  });

  const updateRule = tool({
    description: "Update a rule by id with partial fields",
    inputSchema: z.object({
      id: z.string(),
      patch: z.record(z.any())
    }),
    execute: async ({ id, patch }) => {
      const idx = plan.findIndex((r) => r.id === id);
      if (idx === -1) {
        record("updateRule", { id, patch }, { error: "not_found" }, "error");
        return { error: "Rule not found" } as const;
      }
      const updated = { ...plan[idx], ...patch } as CDNRule;
      plan[idx] = updated;
      record("updateRule", { id, patch }, updated);
      return updated;
    }
  });

  const removeRule = tool({
    description: "Remove a rule by id",
    inputSchema: z.object({ id: z.string() }),
    execute: async ({ id }) => {
      const before = plan.length;
      const remain = plan.filter((r) => r.id !== id);
      if (remain.length === before) {
        record("removeRule", { id }, { removed: 0 }, "error");
        return { removed: 0 } as const;
      }
      while (plan.length) plan.pop();
      for (const r of remain) plan.push(r);
      record("removeRule", { id }, { removed: 1 });
      return { removed: 1 } as const;
    }
  });

  const dedupeRules = tool({
    description: "Deduplicate equivalent rules with semantic awareness",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const seen = new Map<string, CDNRule>();
      const duplicates: CDNRule[] = [];
      for (const rule of plan) {
        const key = canonicalizeRule(rule);
        if (seen.has(key)) {
          duplicates.push(rule);
        } else {
          seen.set(key, rule);
        }
      }

      if (duplicates.length === 0) {
        record("dedupeRules", {}, { removed: 0 });
        return { removed: 0 } as const;
      }

      const keep = Array.from(seen.values());
      while (plan.length) plan.pop();
      for (const r of keep) plan.push(r);
      record(
        "dedupeRules",
        {},
        { removed: duplicates.length, prunedIds: duplicates.map((d) => d.id) }
      );
      return {
        removed: duplicates.length,
        prunedIds: duplicates.map((d) => d.id)
      } as const;
    }
  });

  const validatePlan = tool({
    description: "Validate plan using typed schemas and guardrails",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const rule of plan) {
        const validator = RULE_VALIDATORS[rule.type as RuleSchemaKey];
        if (!validator) continue;
        const parsed = validator.safeParse(rule);
        if (!parsed.success) {
          const detail = parsed.error.issues
            .map((issue) => issue.message)
            .join("; ");
          errors.push(`${rule.type} (${rule.id}) invalid: ${detail}`);
          continue;
        }

        // Extra guardrails beyond schema basics
        if (rule.type === "cache" && rule.ttl > 604_800) {
          warnings.push(
            `Cache rule ${rule.id} ttl>${604_800} seconds; ensure long TTL is intentional.`
          );
        }
        if (rule.type === "canary") {
          if (rule.percentage > 0.3)
            warnings.push(
              `Canary ${rule.id} exceeds 30%; confirm rollout strategy.`
            );
          if (!rule.metricGuardrail)
            warnings.push(
              `Canary ${rule.id} lacks metric guardrail. Consider adding one.`
            );
        }
        if (rule.type === "banner" && rule.schedule && !rule.schedule.end) {
          warnings.push(
            `Banner ${rule.id} has no end date; confirm indefinite banner is desired.`
          );
        }
      }

      const result = { valid: errors.length === 0, errors, warnings } as const;
      record("validatePlan", {}, result, result.valid ? "success" : "error");
      return result;
    }
  });

  const summarizePlan = tool({
    description:
      "Generate a short natural-language summary of the current plan",
    inputSchema: z
      .object({
        focus: z.array(z.enum(SUMMARY_FOCUS)).optional()
      })
      .optional(),
    execute: async ({ focus } = {}) => {
      if (plan.length === 0) {
        const summary =
          "No rules yet. Ask for a configuration to populate the plan.";
        record("summarizePlan", { summary }, summary);
        return { summary } as const;
      }

      const byType = new Map<string, CDNRule[]>();
      for (const rule of plan) {
        const list = byType.get(rule.type) ?? [];
        list.push(rule);
        byType.set(rule.type, list);
      }

      const lines: string[] = [];
      const allowed =
        focus && focus.length > 0 ? new Set<SummaryFocus>(focus) : null;

      const addLine = (type: SummaryFocus, text: string) => {
        if (allowed && !allowed.has(type)) return;
        lines.push(text);
      };

      if (byType.has("cache")) {
        const cacheRules = byType.get("cache") as CacheRule[] | undefined;
        if (cacheRules && cacheRules.length > 0) {
          const fastestTtl = Math.min(...cacheRules.map((rule) => rule.ttl));
          addLine(
            "cache",
            `Caching ${cacheRules.length} path${cacheRules.length === 1 ? "" : "s"} with TTL floor ${fastestTtl}s.`
          );
        }
      }
      if (byType.has("route") || byType.has("canary")) {
        const routes = (byType.get("route") ?? []).length;
        const canaries = (byType.get("canary") ?? []).length;
        if (routes)
          addLine(
            "routing",
            `${routes} permanent route adjustment${routes === 1 ? "" : "s"}.`
          );
        if (canaries)
          addLine(
            "routing",
            `${canaries} canary split${canaries === 1 ? "" : "s"} with guardrails.`
          );
      }
      if (byType.has("security") || byType.has("header")) {
        const headers = (byType.get("header") ?? []).length;
        const security = (byType.get("security") ?? []).length;
        addLine(
          "security",
          `Hardening headers (${headers} general, ${security} security bundles).`
        );
      }
      if (byType.has("performance") || byType.has("image")) {
        const perf = (byType.get("performance") ?? []).length;
        const image = (byType.get("image") ?? []).length;
        addLine(
          "performance",
          `${perf} performance toggles and ${image} image tune-up rule${image === 1 ? "" : "s"}.`
        );
      }
      if (byType.has("banner") || byType.has("transform")) {
        const banners = (byType.get("banner") ?? []).length;
        const transforms = (byType.get("transform") ?? []).length;
        addLine(
          "runtime",
          `${banners} banner${banners === 1 ? "" : "s"} + ${transforms} runtime transform${transforms === 1 ? "" : "s"}.`
        );
      }

      const summary =
        lines.join(" ") ||
        "Plan contains advanced rules; review details panel.";
      record("summarizePlan", { focus }, summary);
      return { summary } as const;
    }
  });

  const scorePlanRisk = tool({
    description: "Score the plan for operational risk (0-100)",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      let score = 5;
      const reasons: string[] = [];

      const add = (delta: number, reason: string) => {
        if (delta === 0) return;
        score += delta;
        reasons.push(`${reason} (+${delta.toFixed(1).replace(/\.0$/, "")})`);
      };

      const totalRules = plan.length;
      if (totalRules > 0) {
        add(Math.min(totalRules * 0.8, 12), `${totalRules} total rules`);
      }

      for (const rule of plan) {
        switch (rule.type) {
          case "canary": {
            const pct = Math.round(rule.percentage * 100);
            add(15 + pct / 2, `Canary ${pct}% on ${rule.path}`);
            if (!rule.metricGuardrail) {
              add(10, `Canary ${rule.path} missing guardrail`);
            }
            break;
          }
          case "banner": {
            add(
              rule.schedule?.end ? 4 : 7,
              `Banner on ${rule.path}${rule.schedule?.end ? " (timed)" : " (no end)"}`
            );
            break;
          }
          case "origin-shield": {
            add(
              6,
              `Origin shield for ${rule.origins.length} origin${rule.origins.length === 1 ? "" : "s"}`
            );
            break;
          }
          case "transform": {
            add(8, `Runtime transform (${rule.action.kind}) on ${rule.path}`);
            break;
          }
          case "route": {
            add(5, `Route ${rule.from} -> ${rule.to}`);
            break;
          }
          case "security": {
            add(1.5, `Security header bundle`);
            break;
          }
          case "rate-limit": {
            add(2.5, `Rate limit on ${rule.path}`);
            break;
          }
          case "access": {
            if (
              (rule.allow?.length ?? 0) === 0 &&
              (rule.deny?.length ?? 0) === 0
            ) {
              add(
                2,
                `Permissive access rule on ${rule.description ?? rule.id}`
              );
            }
            break;
          }
          default: {
            add(1, `${rule.type} rule`);
            break;
          }
        }
      }

      score = Math.min(100, Math.round(score));
      const classification =
        score <= 30
          ? "low"
          : score <= 60
            ? "moderate"
            : score <= 80
              ? "elevated"
              : "high";
      const result = { score, classification, reasons } as const;
      record(
        "scorePlanRisk",
        {},
        result,
        classification === "high" ? "error" : "success"
      );
      return result;
    }
  });

  const todosRef = todos ?? [];

  const addTodoItem = tool({
    description: "Add a todo item associated with the plan",
    inputSchema: z.object({
      text: z.string().min(3),
      status: z.enum(["pending", "done"]).default("pending")
    }),
    execute: async ({ text, status }) => {
      const entry: TodoEntry = { id: crypto.randomUUID(), text, status };
      todosRef.push(entry);
      record("addTodoItem", { text, status }, entry);
      return entry;
    }
  });

  const markTodoItem = tool({
    description: "Update the status of a todo item",
    inputSchema: z.object({
      id: z.string(),
      status: z.enum(["pending", "done"])
    }),
    execute: async ({ id, status }) => {
      const idx = todosRef.findIndex((t) => t.id === id);
      if (idx === -1) {
        const result = { error: "not_found" } as const;
        record("markTodoItem", { id, status }, result, "error");
        return result;
      }
      todosRef[idx] = { ...todosRef[idx], status };
      record("markTodoItem", { id, status }, todosRef[idx]);
      return todosRef[idx];
    }
  });

  // Presets
  const addEcommercePreset = tool({
    description: "Add a set of sensible rules for e-commerce sites",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const rules: CDNRule[] = [
        {
          id: crypto.randomUUID(),
          type: "cache",
          path: "/images/*",
          ttl: 86400,
          description: "Cache product images for 24h"
        },
        {
          id: crypto.randomUUID(),
          type: "performance",
          optimization: "compression",
          enabled: true,
          description: "Enable gzip/brotli"
        },
        {
          id: crypto.randomUUID(),
          type: "header",
          action: "add",
          name: "Cache-Control",
          value: "public, max-age=86400",
          description: "Cache header for static assets"
        }
      ];
      for (const r of rules) plan.push(r);
      record("addEcommercePreset", {}, rules);
      return rules;
    }
  });

  const addSecurityPresetStrict = tool({
    description: "Add a strict security headers preset (CSP/HSTS/XFO)",
    inputSchema: z.object({ domain: z.string().optional() }),
    execute: async ({ domain }) => {
      const rules: CDNRule[] = [
        {
          id: crypto.randomUUID(),
          type: "security",
          csp: "default-src 'self'",
          hstsMaxAge: 31536000,
          xfo: "DENY",
          referrerPolicy: "no-referrer",
          permissionsPolicy: "geolocation=()",
          description: "Strict security headers"
        }
      ];
      for (const r of rules) plan.push(r);
      record("addSecurityPresetStrict", { domain }, rules);
      return rules;
    }
  });

  return {
    addCacheRule,
    addHeaderRule,
    addRouteRule,
    addAccessRule,
    addPerformanceRule,
    addImageRule,
    addRateLimitRule,
    addBotProtectionRule,
    addGeoRoutingRule,
    addSecurityRule,
    addCanaryRule,
    addBannerRule,
    addOriginShieldRule,
    addTransformRule,
    addResearchNote,
    listRules,
    updateRule,
    removeRule,
    dedupeRules,
    validatePlan,
    summarizePlan,
    scorePlanRisk,
    addTodoItem,
    markTodoItem,
    addEcommercePreset,
    addSecurityPresetStrict
  } satisfies ToolSet;
}
