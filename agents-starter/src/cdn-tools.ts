import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";
import type { CDNRule, ResearchNote, ToolTraceEntry } from "@/shared-types";

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

  // Removed todo/completeTodo tools per request

  const addResearchNote = tool({
    description: "Add a research note that supports the chosen optimizations",
    inputSchema: z.object({ note: z.string() }),
    execute: async ({ note }) => {
      const entry: ResearchNote = { id: crypto.randomUUID(), note };
      notes?.push(entry);
      record("addResearchNote", { note }, entry);
      return entry;
    }
  });

  return {
    addCacheRule,
    addHeaderRule,
    addRouteRule,
    addAccessRule,
    addPerformanceRule,
    addResearchNote
  } satisfies ToolSet;
}


