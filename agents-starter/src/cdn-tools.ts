import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";
import type {
  CDNRule,
  ResearchNote,
  ToolTraceEntry,
  ImageRule,
  RateLimitRule,
  BotProtectionRule,
  GeoRoutingRule,
  SecurityRule
} from "@/shared-types";

export function createCDNTools(plan: CDNRule[], trace?: ToolTraceEntry[], _todos?: unknown, notes?: ResearchNote[]) {
  const record = (label: string, input: unknown, output: unknown, status: ToolTraceEntry["status"] = "success") => {
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
  const addCacheRule = tool({
    description: "Add a cache rule (provide path glob and TTL in seconds)",
    inputSchema: z.object({
      path: z.string(),
      ttl: z.number(),
      description: z.string().optional()
    }),
    execute: async ({ path, ttl, description }) => {
      const rule: CDNRule = { id: crypto.randomUUID(), type: "cache", path, ttl, description };
      plan.push(rule);
      record("addCacheRule", { path, ttl, description }, rule);
      return rule;
    }
  });

  const addHeaderRule = tool({
    description: "Add a header rule (add/remove/modify)",
    inputSchema: z.object({
      action: z.enum(["add", "remove", "modify"]),
      name: z.string(),
      value: z.string().optional(),
      description: z.string().optional()
    }),
    execute: async ({ action, name, value, description }) => {
      const rule: CDNRule = { id: crypto.randomUUID(), type: "header", action, name, value, description };
      plan.push(rule);
      record("addHeaderRule", { action, name, value, description }, rule);
      return rule;
    }
  });

  const addRouteRule = tool({
    description: "Add a routing rule (redirect/rewrite/proxy)",
    inputSchema: z.object({
      from: z.string(),
      to: z.string(),
      ruleType: z.enum(["redirect", "rewrite", "proxy"]),
      description: z.string().optional()
    }),
    execute: async ({ from, to, ruleType, description }) => {
      const rule: CDNRule = { id: crypto.randomUUID(), type: "route", from, to, ruleType, description };
      plan.push(rule);
      record("addRouteRule", { from, to, ruleType, description }, rule);
      return rule;
    }
  });

  const addAccessRule = tool({
    description: "Add an access control rule (allow/deny lists)",
    inputSchema: z.object({
      allow: z.array(z.string()).default([]),
      deny: z.array(z.string()).default([]),
      description: z.string().optional()
    }),
    execute: async ({ allow, deny, description }) => {
      const rule: CDNRule = { id: crypto.randomUUID(), type: "access", allow, deny, description };
      plan.push(rule);
      record("addAccessRule", { allow, deny, description }, rule);
      return rule;
    }
  });

  const addPerformanceRule = tool({
    description: "Add a performance optimization rule",
    inputSchema: z.object({
      optimization: z.enum(["compression", "minification", "image-optimization", "lazy-loading"]),
      enabled: z.boolean(),
      description: z.string().optional()
    }),
    execute: async ({ optimization, enabled, description }) => {
      const rule: CDNRule = { id: crypto.randomUUID(), type: "performance", optimization, enabled, description };
      plan.push(rule);
      record("addPerformanceRule", { optimization, enabled, description }, rule);
      return rule;
    }
  });

  // Additional rule tools
  const addImageRule = tool({
    description: "Add an image optimization rule (quality/format/resize)",
    inputSchema: z.object({
      path: z.string(),
      quality: z.number().min(1).max(100).optional(),
      format: z.enum(["auto", "webp", "avif", "jpeg"]).optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      description: z.string().optional()
    }),
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
      record("addImageRule", { path, quality, format, width, height, description }, rule);
      return rule;
    }
  });

  const addRateLimitRule = tool({
    description: "Add a rate limit rule (rpm, burst, action)",
    inputSchema: z.object({
      path: z.string(),
      requestsPerMinute: z.number().positive(),
      burst: z.number().positive().optional(),
      action: z.enum(["block", "challenge", "delay", "log"]),
      description: z.string().optional()
    }),
    execute: async ({ path, requestsPerMinute, burst, action, description }) => {
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
      record("addRateLimitRule", { path, requestsPerMinute, burst, action, description }, rule);
      return rule;
    }
  });

  const addBotProtectionRule = tool({
    description: "Configure bot protection policy",
    inputSchema: z.object({
      mode: z.enum(["off", "js-challenge", "managed-challenge", "block"]),
      sensitivity: z.enum(["low", "medium", "high"]).optional(),
      description: z.string().optional()
    }),
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
    inputSchema: z.object({
      from: z.string(),
      toEU: z.string().optional(),
      toUS: z.string().optional(),
      toAPAC: z.string().optional(),
      fallback: z.string().optional(),
      description: z.string().optional()
    }),
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
      record("addGeoRoutingRule", { from, toEU, toUS, toAPAC, fallback, description }, rule);
      return rule;
    }
  });

  const addSecurityRule = tool({
    description: "Add security headers (CSP/HSTS/XFO/etc)",
    inputSchema: z.object({
      csp: z.string().optional(),
      hstsMaxAge: z.number().optional(),
      xfo: z.string().optional(),
      referrerPolicy: z.string().optional(),
      permissionsPolicy: z.string().optional(),
      description: z.string().optional()
    }),
    execute: async ({ csp, hstsMaxAge, xfo, referrerPolicy, permissionsPolicy, description }) => {
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
      record("addSecurityRule", { csp, hstsMaxAge, xfo, referrerPolicy, permissionsPolicy, description }, rule);
      return rule;
    }
  });

  const addResearchNote = tool({
    description: "Add a research note that supports the chosen optimizations (not for greetings)",
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
      record("listRules", {}, plan);
      return plan;
    }
  });

  const updateRule = tool({
    description: "Update a rule by id with partial fields",
    inputSchema: z.object({
      id: z.string(),
      patch: z.record(z.any())
    }),
    execute: async ({ id, patch }) => {
      const idx = plan.findIndex(r => r.id === id);
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
      const remain = plan.filter(r => r.id !== id);
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
    description: "Deduplicate equivalent rules (naive JSON stringify compare)",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const seen = new Set<string>();
      const unique: CDNRule[] = [];
      for (const r of plan) {
        const key = JSON.stringify({ ...r, id: undefined });
        if (!seen.has(key)) { seen.add(key); unique.push(r); }
      }
      const removed = plan.length - unique.length;
      while (plan.length) plan.pop();
      for (const r of unique) plan.push(r);
      record("dedupeRules", {}, { removed });
      return { removed } as const;
    }
  });

  const validatePlan = tool({
    description: "Validate plan for basic issues (missing fields, invalid ranges)",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const errors: string[] = [];
      for (const r of plan) {
        if (!r.id || !r.type) errors.push(`Rule missing id/type: ${JSON.stringify(r)}`);
        if ((r as any).type === 'cache') {
          const ttl = (r as any).ttl;
          if (typeof ttl !== 'number' || ttl <= 0) errors.push(`Invalid ttl for cache rule ${r.id}`);
        }
      }
      const result = { valid: errors.length === 0, errors } as const;
      record("validatePlan", {}, result, result.valid ? "success" : "error");
      return result;
    }
  });

  // Presets
  const addEcommercePreset = tool({
    description: "Add a set of sensible rules for e-commerce sites",
    inputSchema: z.object({}).optional(),
    execute: async () => {
      const rules: CDNRule[] = [
        { id: crypto.randomUUID(), type: "cache", path: "/images/*", ttl: 86400, description: "Cache product images for 24h" },
        { id: crypto.randomUUID(), type: "performance", optimization: "compression", enabled: true, description: "Enable gzip/brotli" },
        { id: crypto.randomUUID(), type: "header", action: "add", name: "Cache-Control", value: "public, max-age=86400", description: "Cache header for static assets" }
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
        { id: crypto.randomUUID(), type: "security", csp: "default-src 'self'", hstsMaxAge: 31536000, xfo: "DENY", referrerPolicy: "no-referrer", permissionsPolicy: "geolocation=()", description: "Strict security headers" }
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
    addResearchNote,
    listRules,
    updateRule,
    removeRule,
    dedupeRules,
    validatePlan,
    addEcommercePreset,
    addSecurityPresetStrict
  } satisfies ToolSet;
}


