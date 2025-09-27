import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet,
  generateText
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { createCDNTools } from "./cdn-tools";
import type {
  CDNRule,
  ToolTraceEntry,
  TodoEntry,
  ResearchNote,
  EdgePlan,
  EdgePlanVersion,
  PreviewTokenState
} from "@/shared-types";
import type { ConfigDO } from "./config-do";
import { createDefaultPlanVersion } from "./default-plan";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal; model?: string }
  ) {
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const workersai = createWorkersAI({ binding: this.env.AI });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const extractModel = (message: unknown): string | undefined => {
          if (typeof message !== "object" || message === null) return undefined;
          const metadata = (message as { metadata?: { model?: unknown } })
            .metadata;
          if (!metadata || typeof metadata !== "object") return undefined;
          const modelValue = (metadata as { model?: unknown }).model;
          return typeof modelValue === "string" ? modelValue : undefined;
        };

        const isUserMessage = (message: unknown): boolean => {
          if (typeof message !== "object" || message === null) return false;
          const roleValue = (message as { role?: unknown }).role;
          return roleValue === "user";
        };

        let metaModel: string | undefined;
        for (let i = this.messages.length - 1; i >= 0; i--) {
          const candidate = this.messages[i];
          if (isUserMessage(candidate)) {
            const model = extractModel(candidate);
            if (model) {
              metaModel = model;
              break;
            }
          }
        }
        if (!metaModel && this.messages.length > 0) {
          const fallbackMessage = this.messages[this.messages.length - 1];
          const inferredModel = extractModel(fallbackMessage);
          if (inferredModel) {
            metaModel = inferredModel;
          }
        }
        const modelId =
          metaModel ||
          _options?.model ||
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        const model = (
          workersai as unknown as (m: string) => ReturnType<typeof workersai>
        )(modelId);

        const cleanedMessages = cleanupMessages(this.messages);

        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful assistant that can do various tasks... 

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(20)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

let CURRENT_PLAN: CDNRule[] = [];
let CURRENT_ACTIVE_VERSION: EdgePlanVersion | null = null;
let CURRENT_DRAFT_VERSION: EdgePlanVersion | null = null;
let CURRENT_HISTORY: EdgePlanVersion[] = [];
let CURRENT_TOKENS: PreviewTokenState[] = [];

const cloneRules = (rules: CDNRule[]): CDNRule[] =>
  rules.map((rule) => JSON.parse(JSON.stringify(rule)) as CDNRule);

const cloneVersion = (version: EdgePlanVersion): EdgePlanVersion => ({
  ...version,
  plan: {
    ...version.plan,
    rules: cloneRules(version.plan.rules)
  }
});

const recordHistory = (version: EdgePlanVersion) => {
  const snapshot = cloneVersion(version);
  CURRENT_HISTORY = [
    snapshot,
    ...CURRENT_HISTORY.filter((entry) => entry.id !== snapshot.id)
  ];
};

const ensureFallbackActive = () => {
  if (!CURRENT_ACTIVE_VERSION) {
    const seeded = cloneVersion(createDefaultPlanVersion());
    CURRENT_ACTIVE_VERSION = seeded;
    CURRENT_PLAN = cloneRules(seeded.plan.rules);
    recordHistory(seeded);
  }
};

const pruneExpiredTokens = () => {
  const now = Date.now();
  CURRENT_TOKENS = CURRENT_TOKENS.filter((token) => {
    if (!token.expiresAt) return true;
    return new Date(token.expiresAt).getTime() > now;
  });
};

const getActiveVersionResponse = () =>
  CURRENT_ACTIVE_VERSION ? cloneVersion(CURRENT_ACTIVE_VERSION) : null;

const getDraftVersionResponse = () =>
  CURRENT_DRAFT_VERSION ? cloneVersion(CURRENT_DRAFT_VERSION) : null;

const getVersionsResponse = () => CURRENT_HISTORY.map(cloneVersion);

type GenerateTextParams = Parameters<typeof generateText>[0];
type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

interface Env {
  Chat: DurableObjectNamespace<Chat>;
  AI: Ai;
  CONFIG_KV?: KVNamespace;
  ConfigDO?: DurableObjectNamespace<ConfigDO>;
  ORIGIN_URL?: string;
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      const hasWorkersAI = !!env.AI;
      return Response.json({
        success: hasWorkersAI
      });
    }

    if (url.pathname === "/ai-test") {
      try {
        const modelParam = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        const body = { prompt: "Say hello from Workers AI" } as const;
        const runPromise = env.AI.run(
          modelParam as keyof AiModels,
          body as never
        );

        const timed = await Promise.race([
          runPromise,
          new Promise((resolve) =>
            setTimeout(() => resolve("__TIMEOUT__"), 15000)
          )
        ] as const);

        if (timed === "__TIMEOUT__") {
          console.error("env.AI.run timed out after 15s");
          return new Response(JSON.stringify({ error: "timeout" }), {
            status: 504,
            headers: { "content-type": "application/json" }
          });
        }

        return Response.json(timed);
      } catch (error) {
        console.error("env.AI.run failed", error);
        return Response.json(
          {
            error: "ai_run_failed",
            message: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    if (!env.AI) {
      console.error(
        'Workers AI binding (AI) is not set. Ensure `wrangler.jsonc` contains { "ai": { "binding": "AI" } } and that types/env are generated.'
      );
    }

    if (url.pathname.startsWith("/api/")) {
      return handleAPI(request, env);
    }

    if (url.pathname.startsWith("/preview/")) {
      const route = url.searchParams.get("route") || "v1";
      const cache = url.searchParams.get("cache") || "HIT";
      const hits = url.searchParams.get("hits") || "0";
      const miss = url.searchParams.get("miss") || "0";
      const p95 = url.searchParams.get("p95") || "90";

      return new Response(
        `
        <html>
          <head>
            <title>CDN Preview</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; }
              .hud { position: fixed; top: 12px; right: 12px; background: rgba(0,0,0,0.8); color:#fff; padding:12px; border-radius:10px; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; min-width: 200px; }
              .row { display:flex; justify-content: space-between; gap:12px; margin: 4px 0; }
              .pill { padding:2px 6px; border-radius: 999px; font-weight:600; }
              .ok { background:#16a34a; }
              .warn { background:#ea580c; }
              .err { background:#dc2626; }
              .wrap { padding: 32px; }
            </style>
          </head>
          <body>
            <div class="wrap">
              <h1>Preview Surface</h1>
              <p>You are viewing the active edge plan for this preview token. The HUD shows the route, cache verdict, and request metrics so you can verify behaviour before shipping.</p>
              <p><small>When this version is promoted the preview mirrors exactly what the Worker returns to browsers.</small></p>
            </div>
            <div class="hud">
              <div class="row"><span>Route:</span><span class="pill ${route === "v1" ? "ok" : "warn"}">${route.toUpperCase()}</span></div>
              <div class="row"><span>Cache:</span><span class="pill ${cache === "HIT" ? "ok" : "err"}">${cache}</span></div>
              <div class="row"><span>Hits/Misses:</span><span>${hits} / ${miss}</span></div>
              <div class="row"><span>P95:</span><span>${p95}ms</span></div>
            </div>
          </body>
        </html>
      `,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    if (url.pathname.startsWith("/do/")) {
      return Response.json({
        message: "Durable Object routes are handled via the /api endpoints",
        status: "not_available"
      });
    }

    const runtimeResponse = await applyEdgeRuntime(request, env);
    if (runtimeResponse) return runtimeResponse;

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;

/**
 * API route handlers (separate from the main worker class)
 */
async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const hasConfigDO = Boolean(env.ConfigDO);

  const forward = async (
    target: string,
    init?: RequestInit & { body?: string }
  ) => forwardToConfigDO(env, target, init);

  if (path.startsWith("/api/token/") && method === "DELETE") {
    const token = path.split("/").pop() ?? "";
    if (hasConfigDO) {
      return forward(`/token/${token}`, { method: "DELETE" });
    }
    pruneExpiredTokens();
    CURRENT_TOKENS = CURRENT_TOKENS.filter((entry) => entry.token !== token);
    return Response.json({ token, deleted: true });
  }

  if (path === "/api/active" && method === "GET") {
    if (hasConfigDO) return forward("/active");
    ensureFallbackActive();
    return Response.json({ active: getActiveVersionResponse() });
  }

  if (path === "/api/draft" && method === "GET") {
    if (hasConfigDO) return forward("/draft");
    return Response.json({ draft: getDraftVersionResponse() });
  }

  if (path === "/api/versions" && method === "GET") {
    if (hasConfigDO) return forward("/versions");
    ensureFallbackActive();
    return Response.json({ versions: getVersionsResponse() });
  }

  if (path.startsWith("/api/versions/") && method === "GET") {
    const versionId = path.split("/")[3];
    if (hasConfigDO) return forward(`/versions/${versionId}`);
    ensureFallbackActive();
    const match = CURRENT_HISTORY.find((entry) => entry.id === versionId);
    if (match) {
      return Response.json({ version: cloneVersion(match) });
    }
    if (CURRENT_DRAFT_VERSION && CURRENT_DRAFT_VERSION.id === versionId) {
      return Response.json({ version: getDraftVersionResponse() });
    }
    return Response.json({ message: "Version not found" }, { status: 404 });
  }

  if (path === "/api/plan" && method === "POST") {
    if (hasConfigDO) {
      const bodyText = await request.text();
      return forward("/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bodyText
      });
    }
    const payload = (await request.json()) as {
      plan: EdgePlan;
      description?: string;
      promotedBy?: string;
    };
    await persistDraftPlan(env, payload.plan, payload.description);
    if (CURRENT_DRAFT_VERSION && payload.promotedBy) {
      CURRENT_DRAFT_VERSION = {
        ...CURRENT_DRAFT_VERSION,
        promotedBy: payload.promotedBy
      };
    }
    return Response.json({
      draft: getDraftVersionResponse(),
      message: "Draft saved (fallback)"
    });
  }

  if (path === "/api/promote" && method === "POST") {
    if (hasConfigDO) {
      const bodyText = await request.text();
      return forward("/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bodyText
      });
    }
    const payload = (await request.json()) as {
      versionId?: string;
      promotedBy?: string;
    };
    ensureFallbackActive();
    const candidate = payload.versionId
      ? (CURRENT_HISTORY.find((entry) => entry.id === payload.versionId) ??
        (CURRENT_DRAFT_VERSION && CURRENT_DRAFT_VERSION.id === payload.versionId
          ? CURRENT_DRAFT_VERSION
          : null))
      : (CURRENT_DRAFT_VERSION ?? CURRENT_ACTIVE_VERSION);

    if (!candidate) {
      return Response.json({ error: "draft_not_found" }, { status: 404 });
    }

    const promoted = {
      ...cloneVersion(candidate),
      promotedAt: new Date().toISOString(),
      promotedBy: payload.promotedBy ?? candidate.promotedBy
    };

    CURRENT_ACTIVE_VERSION = promoted;
    CURRENT_PLAN = cloneRules(promoted.plan.rules);
    recordHistory(promoted);
    if (CURRENT_DRAFT_VERSION && CURRENT_DRAFT_VERSION.id === promoted.id) {
      CURRENT_DRAFT_VERSION = null;
    }

    return Response.json({
      active: promoted,
      message: "Plan promoted (fallback)"
    });
  }

  if (path === "/api/rollback" && method === "POST") {
    if (hasConfigDO) {
      const bodyText = await request.text();
      return forward("/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bodyText
      });
    }
    const payload = (await request.json()) as {
      versionId: string;
      promotedBy?: string;
    };
    ensureFallbackActive();
    const target = CURRENT_HISTORY.find(
      (entry) => entry.id === payload.versionId
    );
    if (!target) {
      return Response.json({ error: "version_not_found" }, { status: 404 });
    }
    const rolledBack = {
      ...cloneVersion(target),
      promotedAt: new Date().toISOString(),
      promotedBy: payload.promotedBy ?? target.promotedBy
    };
    CURRENT_ACTIVE_VERSION = rolledBack;
    CURRENT_PLAN = cloneRules(rolledBack.plan.rules);
    recordHistory(rolledBack);
    return Response.json({
      active: rolledBack,
      message: "Rollback complete (fallback)"
    });
  }

  if (path === "/api/token" && method === "POST") {
    if (hasConfigDO) {
      const bodyText = await request.text();
      return forward("/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bodyText
      });
    }
    const payload = (await request.json()) as {
      versionId?: string;
      expiresInSeconds?: number;
    };
    ensureFallbackActive();
    const targetId = payload.versionId ?? CURRENT_ACTIVE_VERSION?.id;
    if (!targetId) {
      return Response.json({ error: "version_not_found" }, { status: 404 });
    }
    const version =
      CURRENT_HISTORY.find((entry) => entry.id === targetId) ??
      (CURRENT_ACTIVE_VERSION && CURRENT_ACTIVE_VERSION.id === targetId
        ? CURRENT_ACTIVE_VERSION
        : null);
    if (!version) {
      return Response.json({ error: "version_not_found" }, { status: 404 });
    }
    const tokenState: PreviewTokenState = {
      token: crypto.randomUUID(),
      versionId: version.id,
      createdAt: new Date().toISOString(),
      expiresAt: payload.expiresInSeconds
        ? new Date(Date.now() + payload.expiresInSeconds * 1000).toISOString()
        : undefined
    };
    pruneExpiredTokens();
    CURRENT_TOKENS = [
      tokenState,
      ...CURRENT_TOKENS.filter((entry) => entry.token !== tokenState.token)
    ];
    return Response.json({ token: tokenState });
  }

  if (path === "/api/tokens" && method === "GET") {
    if (hasConfigDO) return forward("/tokens");
    pruneExpiredTokens();
    return Response.json({ tokens: CURRENT_TOKENS });
  }

  if (path.startsWith("/api/token/")) {
    if (method === "DELETE") {
      const token = path.split("/").pop() as string;
      return forwardToConfigDO(env, `/token/${token}`, { method: "DELETE" });
    }
  }

  if (path === "/api/active" && method === "GET") {
    return forwardToConfigDO(env, "/active");
  }

  if (path === "/api/draft" && method === "GET") {
    return forwardToConfigDO(env, "/draft");
  }

  if (path === "/api/versions" && method === "GET") {
    return forwardToConfigDO(env, "/versions");
  }

  if (path.startsWith("/api/versions/") && method === "GET") {
    const versionId = path.split("/")[3];
    return forwardToConfigDO(env, `/versions/${versionId}`);
  }

  if (path === "/api/plan" && method === "POST") {
    return forwardToConfigDO(env, "/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text()
    });
  }

  if (path === "/api/promote" && method === "POST") {
    return forwardToConfigDO(env, "/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text()
    });
  }

  if (path === "/api/rollback" && method === "POST") {
    return forwardToConfigDO(env, "/rollback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text()
    });
  }

  if (path === "/api/token" && method === "POST") {
    return forwardToConfigDO(env, "/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text()
    });
  }

  if (path === "/api/tokens" && method === "GET") {
    return forwardToConfigDO(env, "/tokens");
  }

  switch (path) {
    case "/api/examples":
      return getExamples();

    case "/api/generate":
      return generateConfig(request, env);

    case "/api/validate":
      return validateConfig(await request.json());

    case "/api/simulate":
      return simulateConfig(await request.json());

    case "/api/export":
      return exportConfig(await request.json());

    case "/api/save":
      return saveConfig(await request.json(), env);

    case "/api/current":
      return getCurrent(env);

    default:
      return new Response("API endpoint not found", { status: 404 });
  }
}

/**
 * Get example CDN configurations
 */
function getExamples(): Response {
  const examples = {
    basic: [
      {
        type: "cache",
        path: "/img/*",
        ttl: 86400,
        description: "Cache images for 24 hours"
      }
    ],
    ecommerce: [
      {
        type: "cache",
        path: "/img/*",
        ttl: 86400,
        description: "Cache product images"
      },
      {
        type: "header",
        action: "add",
        name: "X-Frame-Options",
        value: "DENY",
        description: "Prevent clickjacking"
      }
    ]
  };

  return Response.json({
    examples,
    message: "Example CDN configurations for different use cases"
  });
}

/**
 * Generate CDN configuration using AI
 */
async function generateConfig(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      scenario?: string;
    };
    const prompt = body.prompt || "";
    if (!prompt) {
      return new Response("Prompt is required", { status: 400 });
    }

    if (!env.AI) {
      return new Response("Workers AI not configured", { status: 500 });
    }
    const plan: CDNRule[] = [];
    const trace: ToolTraceEntry[] = [];
    const todos: TodoEntry[] = [];
    const notes: ResearchNote[] = [];
    const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as keyof AiModels;
    const cdnTools = createCDNTools(plan, trace, todos, notes);
    const runTool = async <TArg, TResult>(
      label: string,
      toolRef: unknown,
      args?: TArg
    ): Promise<TResult | null> => {
      const maybeExecute = (toolRef as { execute?: unknown })?.execute;
      if (typeof maybeExecute !== "function") return null;
      try {
        const executor = maybeExecute as (
          input: TArg | undefined,
          context?: unknown
        ) => Promise<TResult>;
        return await executor(args, undefined);
      } catch (error) {
        trace.push({
          id: crypto.randomUUID(),
          label: `${label} (auto)`,
          status: "error",
          input: args,
          output: {
            error: error instanceof Error ? error.message : String(error)
          },
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    };
    const workersai = createWorkersAI({ binding: env.AI });
    const modelFn = (
      workersai as unknown as (m: string) => ReturnType<typeof workersai>
    )(model);

    let completion: GenerateTextResult | undefined;
    try {
      const generationParams: GenerateTextParams = {
        system: `You are an AI edge configuration specialist. Hold a natural conversation and call tools to build, analyse, and polish a CDN plan.\n\nGuidance:\n- Confirm intent and missing parameters before invoking tools.\n- Use the rich toolset: cache/header/route/access/performance/image/rate-limit/bot/security, plus advanced rules (canary, banner, origin-shield, transform) and utilities (summarizePlan, scorePlanRisk, addTodoItem, validatePlan, dedupeRules).\n- Keep tool runs purposeful (<= 8 round-trips). Compose multiple tools per turn when assembling complex plans (e.g., canary + guardrail + banner).\n- Never describe or suggest raw tool JSON; execute the tool call instead.\n- Summarize the impact after tool execution and surface any warnings from validation/risk scoring.\n- Only add research notes or todo items when they help humans review the plan.\n- Stay within approved actions: no external proxy origins in v1, canary percentage <= 50%, and prefer guardrails for risky changes.`,
        model: modelFn,
        tools: cdnTools,
        toolChoice: "auto",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        stopWhen: stepCountIs(20)
      };
      completion = await generateText(generationParams);
    } catch (e) {
      console.warn("tool-generation failed, falling back to JSON mode", e);
    }

    if (plan.length === 0) {
      try {
        const jsonSystem = [
          'You are a CDN configuration generator. Output ONLY a JSON array of rule objects. Each object must include a "type" field with values from:',
          '"cache", "header", "route", "access", "performance", "image", "rate-limit", "bot-protection", "geo-routing", "security", "canary", "banner", "origin-shield", "transform".',
          "Fields per type:",
          "- cache: path (string glob), ttl (number, seconds), description?",
          '- header: action ("add"|"remove"|"modify"), name (string), value?, description?',
          '- route: from (string), to (string), ruleType ("redirect"|"rewrite"|"proxy"), description?',
          "- access: allow (string[]), deny (string[]), description?",
          '- performance: optimization ("compression"|"minification"|"image-optimization"|"lazy-loading"), enabled (boolean), description?',
          '- image: path (string), quality? (1-100), format? ("auto"|"webp"|"avif"|"jpeg"), width?, height?, description?',
          '- rate-limit: path (string), requestsPerMinute (number), burst?, action ("block"|"challenge"|"delay"|"log"), description?',
          '- bot-protection: mode ("off"|"js-challenge"|"managed-challenge"|"block"), sensitivity?, description?',
          "- geo-routing: from (string), toEU?, toUS?, toAPAC?, fallback?, description?",
          "- security: csp?, hstsMaxAge?, xfo?, referrerPolicy?, permissionsPolicy?, description?",
          '- canary: path (string), primaryOrigin (string), canaryOrigin (string), percentage (0-0.5), stickyBy? ("cookie"|"header"|"ip"|"session"), metricGuardrail? ({ metric: "latency"|"error_rate"|"cache_hit", operator: "lt"|"gt"|"lte"|"gte", threshold: number }), description?',
          "- banner: path (string), message (string), style? ({ tone?: string, theme?: string }), schedule? ({ start?: string, end?: string, timezone?: string }), audience? ({ segment?: string, geo?: string[] }), description?",
          '- origin-shield: origins (string[]), tieredCaching? ("smart"|"regional"|"off"), healthcheck? ({ path: string, intervalSeconds?: number, timeoutMs?: number }), description?',
          '- transform: path (string), phase ("request"|"response"), action ({ kind: "header"|"html-inject"|"rewrite-url", ... }), description?',
          "Return a compact JSON array. Do not include any explanation or markdown.",
          "Wrap the JSON array between <JSON> and </JSON> tags and output nothing else."
        ].join("\n");

        const rawResponse = await env.AI.run(model, {
          prompt: `SYSTEM:\n${jsonSystem}\n\nUSER:\nGenerate CDN rules for: ${prompt}`,
          max_tokens: 800,
          temperature: 0.2
        } as never);

        const extractRawText = (response: unknown): string => {
          if (typeof response === "string") {
            return response;
          }
          if (typeof response !== "object" || response === null) {
            return JSON.stringify(response);
          }
          const structured = response as {
            output?: Array<{ text?: string }>;
            output_text?: string;
            text?: string;
          };
          if (Array.isArray(structured.output)) {
            const firstWithText = structured.output.find(
              (entry) => typeof entry?.text === "string"
            );
            if (firstWithText?.text) return firstWithText.text;
          }
          if (typeof structured.output_text === "string") {
            return structured.output_text;
          }
          if (typeof structured.text === "string") {
            return structured.text;
          }
          return JSON.stringify(response);
        };

        let raw = extractRawText(rawResponse);

        const tryUnescape = (value: string): string => {
          const trimmed = value.trim();
          if (/^"[\s\S]*"$/.test(trimmed)) {
            try {
              return JSON.parse(trimmed) as string;
            } catch {
              return value;
            }
          }
          return value;
        };
        if (typeof raw === "string") raw = tryUnescape(raw);

        let arraySource: string | null = null;
        if (typeof raw === "string") {
          const tag = raw.match(/<JSON>([\s\S]*?)<\/JSON>/);
          if (tag?.[1]) {
            arraySource = tag[1].trim();
          } else {
            const bracket = raw.match(/\[[\s\S]*\]/);
            if (bracket?.[0]) arraySource = bracket[0];
            else {
              const unescaped = raw
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\r/g, "\r");
              const br2 = unescaped.match(/\[[\s\S]*\]/);
              if (br2?.[0]) arraySource = br2[0];
            }
          }
        }

        if (arraySource) {
          let src = arraySource.trim();
          if (/^"[\s\S]*"$/.test(src)) {
            const snapshot = src;
            try {
              src = JSON.parse(snapshot) as string;
            } catch {
              src = snapshot;
            }
          }

          const normalizeToJson = (input: string): string => {
            let candidate = input.trim();
            candidate = candidate.replace(/^(\\[nrt])+/, "");
            candidate = candidate.replace(
              /^```[\w-]*\n([\s\S]*?)\n```$/m,
              "$1"
            );
            candidate = candidate.replace(
              /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
              '"$1"'
            );
            candidate = candidate.replace(
              /([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g,
              '$1"$2"$3'
            );
            candidate = candidate.replace(/,(\s*[\]}])/g, "$1");
            return candidate
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t")
              .replace(/\\r/g, "\r");
          };

          const jsonText = normalizeToJson(src);
          let parsed: unknown;
          try {
            parsed = JSON.parse(jsonText);
          } catch {
            const br = jsonText.match(/\[[\s\S]*\]/);
            if (br?.[0]) {
              try {
                parsed = JSON.parse(br[0]);
              } catch {
                parsed = undefined;
              }
            }
          }
          if (Array.isArray(parsed)) {
            for (const r of parsed) {
              const withId = {
                id: crypto.randomUUID(),
                ...(r as object)
              } as CDNRule;
              plan.push(withId);
            }
            trace.push({
              id: crypto.randomUUID(),
              label: "fallback_json_parse",
              status: "success",
              input: { raw },
              output: parsed,
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.warn("json fallback failed", e);
      }
    }

    let summaryResult: { summary: string } | null = null;
    let validationResult: {
      valid: boolean;
      errors: string[];
      warnings: string[];
    } | null = null;
    let riskResult: {
      score: number;
      classification: string;
      reasons: string[];
    } | null = null;
    let riskAuditText: string | null = null;

    if (plan.length > 0) {
      await runTool("dedupeRules", cdnTools.dedupeRules);
      validationResult = await runTool("validatePlan", cdnTools.validatePlan);
      summaryResult = await runTool("summarizePlan", cdnTools.summarizePlan);
      riskResult = await runTool("scorePlanRisk", cdnTools.scorePlanRisk);

      const todoTexts = new Set(todos.map((t) => t.text.toLowerCase()));
      const ensureTodo = async (text: string) => {
        const key = text.toLowerCase();
        if (todoTexts.has(key)) return;
        await runTool("addTodoItem", cdnTools.addTodoItem, {
          text,
          status: "pending"
        });
        todoTexts.add(key);
      };

      if (validationResult) {
        for (const err of validationResult.errors ?? []) {
          await ensureTodo(`Fix validation error: ${err}`);
        }
        for (const warn of validationResult.warnings ?? []) {
          await ensureTodo(`Review warning: ${warn}`);
        }
      }

      if (riskResult && riskResult.score >= 60) {
        await ensureTodo(
          `Review plan risk (${riskResult.classification}, score ${riskResult.score}).`
        );
      }
      try {
        const auditPrompt = `You are reviewing a proposed CDN configuration. Analyze risk from 0 (trivial) to 100 (catastrophic). Consider canary percentages, missing guardrails, rewrites, origin shielding, permissive access, runtime transforms, banners without end dates, and total change volume. Respond with a short heading, then a line "Score: <number>", followed by 3-5 bullet-style sentences explaining the risk.\n\nRules:\n${JSON.stringify(plan, null, 2)}`;
        const auditParams: GenerateTextParams = {
          system:
            "You are a senior edge reliability engineer performing a production readiness review.",
          model: modelFn,
          messages: [{ role: "user", content: auditPrompt }],
          temperature: 0
        };
        const auditResponse = await generateText(auditParams);
        if (typeof auditResponse?.text === "string") {
          riskAuditText = auditResponse.text.trim();
        }
      } catch (auditError) {
        console.warn("risk audit failed", auditError);
      }

      if (riskAuditText) {
        const scoreMatch = riskAuditText.match(/Score:\s*(\d{1,3})/i);
        if (scoreMatch) {
          const parsedScore = Math.min(100, Math.max(0, Number(scoreMatch[1])));
          const classification =
            parsedScore <= 30
              ? "low"
              : parsedScore <= 60
                ? "moderate"
                : parsedScore <= 80
                  ? "elevated"
                  : "high";
          const parsedReasons = riskResult?.reasons?.length
            ? riskResult.reasons
            : riskAuditText
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => /^[-•]/.test(line))
                .map((line) => line.replace(/^[-•]\s*/, ""));
          riskResult = {
            score: parsedScore,
            classification,
            reasons: parsedReasons
          };
          if (parsedScore >= 60) {
            await ensureTodo(
              `Review plan risk (${classification}, score ${parsedScore}).`
            );
          }
        }
      }
    }

    const validationPayload = validationResult ?? {
      valid: plan.length > 0,
      errors: [] as string[],
      warnings: [] as string[]
    };

    const assistantInsights: string[] = [];
    if (summaryResult?.summary)
      assistantInsights.push(summaryResult.summary.trim());
    if (validationPayload.warnings.length) {
      assistantInsights.push(
        `Warnings: ${validationPayload.warnings.join(" | ")}`
      );
    }
    if (validationPayload.errors.length) {
      assistantInsights.push(`Errors: ${validationPayload.errors.join(" | ")}`);
    }
    if (riskResult) {
      assistantInsights.push(
        `Risk level: ${riskResult.classification} (score ${riskResult.score}).`
      );
      if (Array.isArray(riskResult.reasons) && riskResult.reasons.length) {
        assistantInsights.push(
          `Risk drivers: ${riskResult.reasons.join("; ")}`
        );
      }
    }

    const completionText = (() => {
      if (
        completion &&
        typeof completion === "object" &&
        "text" in completion &&
        typeof (completion as { text?: unknown }).text === "string"
      ) {
        return (completion as { text: string }).text.trim();
      }
      return "";
    })();
    let assistantMessage = completionText;
    const insightsSummary = assistantInsights.join("\n");
    if (insightsSummary) {
      if (
        !assistantMessage ||
        /function call should look like/i.test(assistantMessage)
      ) {
        assistantMessage = insightsSummary;
      } else {
        assistantMessage = `${assistantMessage}\n\n${insightsSummary}`;
      }
    }
    if (!assistantMessage && plan.length > 0) {
      assistantMessage = `Generated ${plan.length} rule${plan.length === 1 ? "" : "s"}.`;
    }

    const planRecord: EdgePlan = {
      id: crypto.randomUUID(),
      rules: plan,
      createdAt: new Date().toISOString(),
      summary: summaryResult?.summary ?? undefined
    };

    const draftVersionId = await persistDraftPlan(
      env,
      planRecord,
      summaryResult?.summary ?? undefined
    );

    const insights = {
      summary: summaryResult?.summary ?? null,
      validation: validationPayload,
      risk: riskResult,
      riskAudit: riskAuditText
    };

    return Response.json({
      config: plan,
      trace,
      todos,
      notes,
      assistant: assistantMessage,
      insights,
      validation: validationPayload,
      draftVersionId,
      prompt,
      message: "Configuration generated successfully (tools)"
    });
  } catch (error) {
    console.error("Error generating config:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

/**
 * Validate a CDN configuration
 */
function validateConfig(configData: { config?: unknown }): Response {
  const config = configData.config || [];
  const isValid = Array.isArray(config);

  return Response.json({
    validation: {
      success: isValid,
      errors: isValid ? [] : ["Invalid configuration format"]
    },
    message: isValid ? "Configuration is valid" : "Configuration has errors"
  });
}

/**
 * Simulate CDN configuration performance
 */
function simulateConfig(simData: {
  config?: unknown;
  requestCount?: number;
}): Response {
  const requestCount = simData.requestCount || 100;

  const metrics = {
    responseTime: 80 + Math.random() * 40,
    cacheHitRate: 0.7 + Math.random() * 0.3,
    compressionRatio: 0.4 + Math.random() * 0.4,
    totalRequests: requestCount,
    errors: Math.floor(Math.random() * 5)
  };

  return Response.json({
    metrics,
    summary: `Simulation completed for ${requestCount} requests`
  });
}

/**
 * Export a configuration as downloadable JSON
 */
function exportConfig(data: { config?: unknown; filename?: string }): Response {
  const config = data?.config ?? [];
  const filename = (data?.filename || "cdn-config.json").replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=${filename}`
    }
  });
}

/**
 * Save applied configuration to KV (if bound) or memory
 */
async function saveConfig(
  data: { config?: CDNRule[] },
  env: Env
): Promise<Response> {
  const cfg = Array.isArray(data?.config) ? data!.config! : [];
  if (env.CONFIG_KV) {
    await env.CONFIG_KV.put("current_plan", JSON.stringify(cfg));
  } else {
    ensureFallbackActive();
    CURRENT_PLAN = cloneRules(cfg);
    if (CURRENT_ACTIVE_VERSION) {
      CURRENT_ACTIVE_VERSION = {
        ...CURRENT_ACTIVE_VERSION,
        plan: {
          ...CURRENT_ACTIVE_VERSION.plan,
          rules: cloneRules(cfg)
        }
      };
      recordHistory(CURRENT_ACTIVE_VERSION);
    }
  }
  return Response.json({ saved: true, count: cfg.length });
}

/**
 * Retrieve current configuration
 */
async function getCurrent(env: Env): Promise<Response> {
  if (env.CONFIG_KV) {
    const txt = await env.CONFIG_KV.get("current_plan");
    const cfg = txt ? (JSON.parse(txt) as CDNRule[]) : [];
    return Response.json({ config: cfg });
  }
  return Response.json({ config: CURRENT_PLAN });
}

const CONFIG_DO_NAME = "edge-config";

async function persistDraftPlan(
  env: Env,
  plan: EdgePlan,
  description?: string
): Promise<string | null> {
  if (env.ConfigDO) {
    const id = env.ConfigDO.idFromName(CONFIG_DO_NAME);
    const stub = env.ConfigDO.get(id);
    const res = await stub.fetch("https://config/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, description })
    });
    if (res.ok) {
      const data = (await res.json()) as { draft?: EdgePlanVersion };
      return data.draft?.id ?? null;
    }
    return null;
  } else {
    ensureFallbackActive();
    const draftPlan: EdgePlan = {
      ...plan,
      id: plan.id || crypto.randomUUID(),
      createdAt: plan.createdAt ?? new Date().toISOString(),
      rules: cloneRules(plan.rules)
    };
    const draftVersion: EdgePlanVersion = {
      id: draftPlan.id,
      plan: draftPlan,
      description
    };
    CURRENT_DRAFT_VERSION = draftVersion;
    return draftVersion.id;
  }
}

async function fetchActivePlan(
  env: Env
): Promise<{ plan: EdgePlan; versionId?: string } | null> {
  if (env.ConfigDO) {
    const id = env.ConfigDO.idFromName(CONFIG_DO_NAME);
    const stub = env.ConfigDO.get(id);
    const res = await stub.fetch("https://config/active");
    if (res.ok) {
      const data = (await res.json()) as { active?: EdgePlanVersion | null };
      if (data.active) {
        return { plan: data.active.plan, versionId: data.active.id };
      }
    }
  }

  ensureFallbackActive();
  if (!CURRENT_ACTIVE_VERSION) return null;
  const activeClone = cloneVersion(CURRENT_ACTIVE_VERSION);
  CURRENT_PLAN = cloneRules(activeClone.plan.rules);
  return {
    plan: activeClone.plan,
    versionId: activeClone.id
  };
}

async function forwardToConfigDO(
  env: Env,
  path: string,
  init?: RequestInit & { body?: string }
): Promise<Response> {
  if (!env.ConfigDO) {
    return Response.json(
      { error: "config_durable_object_unavailable" },
      { status: 503 }
    );
  }
  const id = env.ConfigDO.idFromName(CONFIG_DO_NAME);
  const stub = env.ConfigDO.get(id);
  const requestInit = init ?? {};
  const req = new Request(`https://config${path}`, requestInit);
  return stub.fetch(req);
}

async function applyEdgeRuntime(
  request: Request,
  env: Env
): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }

  const active = await fetchActivePlan(env);
  if (!active || active.plan.rules.length === 0) {
    return null;
  }

  const url = new URL(request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/preview/")
  ) {
    return null;
  }

  const matchedRules: CDNRule[] = [];
  let targetUrl = new URL(request.url);
  let redirectLocation: string | null = null;
  let cacheTtl: number | undefined;
  const headersToSet: Array<{ name: string; value: string }> = [];
  const headersToRemove: string[] = [];
  let bannerRule: CDNRule | null = null;
  let selectedRouteLabel = "primary";

  for (const rule of active.plan.rules) {
    if (!matchesRulePath(rule, url.pathname)) continue;
    matchedRules.push(rule);

    switch (rule.type) {
      case "route": {
        if (rule.ruleType === "redirect") {
          redirectLocation = rule.to;
        } else if (rule.ruleType === "rewrite") {
          targetUrl = new URL(targetUrl.toString());
          targetUrl.pathname = rule.to;
        }
        break;
      }
      case "cache": {
        cacheTtl = rule.ttl;
        headersToSet.push({
          name: "Cache-Control",
          value: `public, max-age=${rule.ttl}`
        });
        break;
      }
      case "header": {
        if (rule.action === "add" || rule.action === "modify") {
          if (rule.value !== undefined)
            headersToSet.push({ name: rule.name, value: rule.value });
        }
        if (rule.action === "remove") {
          headersToRemove.push(rule.name);
        }
        break;
      }
      case "security": {
        if (rule.csp)
          headersToSet.push({
            name: "Content-Security-Policy",
            value: rule.csp
          });
        if (rule.hstsMaxAge)
          headersToSet.push({
            name: "Strict-Transport-Security",
            value: `max-age=${rule.hstsMaxAge}`
          });
        if (rule.xfo)
          headersToSet.push({ name: "X-Frame-Options", value: rule.xfo });
        if (rule.referrerPolicy)
          headersToSet.push({
            name: "Referrer-Policy",
            value: rule.referrerPolicy
          });
        if (rule.permissionsPolicy)
          headersToSet.push({
            name: "Permissions-Policy",
            value: rule.permissionsPolicy
          });
        break;
      }
      case "banner": {
        bannerRule = rule;
        break;
      }
      case "canary": {
        const fingerprint =
          request.headers.get("CF-Connecting-IP") ??
          request.headers.get("X-Forwarded-For") ??
          url.pathname;
        const ratio = deterministicRatio(fingerprint + rule.path);
        if (ratio < rule.percentage) {
          selectedRouteLabel = rule.canaryOrigin;
          if (rule.canaryOrigin.startsWith("http")) {
            targetUrl = new URL(rule.canaryOrigin);
          } else if (rule.canaryOrigin.startsWith("/")) {
            targetUrl = new URL(targetUrl.toString());
            targetUrl.pathname = rule.canaryOrigin;
          }
        } else {
          selectedRouteLabel = rule.primaryOrigin;
        }
        break;
      }
      default:
        break;
    }
  }

  if (redirectLocation) {
    return Response.redirect(redirectLocation, 302);
  }

  if (!env.ORIGIN_URL) {
    const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
    headersToRemove.forEach((header) => {
      headers.delete(header);
    });
    headersToSet.forEach(({ name, value }) => {
      headers.set(name, value);
    });
    headers.set("X-Edge-Composer-Version", active.versionId ?? "in-memory");
    headers.set("X-Edge-Composer-Route", selectedRouteLabel);
    if (matchedRules.length) {
      headers.set(
        "X-Edge-Composer-Rules",
        matchedRules.map((r) => r.type).join(",")
      );
    }
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Edge Composer Preview</title></head><body style="font-family:system-ui;background:#0f1729;color:#f8fafc;padding:32px;"><h1>Edge Composer Preview</h1><p>This response is rendered by the edge plan so you can confirm which rules matched for <code>${url.pathname}</code>.</p><p><small>Set an <code>ORIGIN_URL</code> when you are ready to proxy your upstream; the HUD and headers already reflect the active configuration.</small></p><pre style="background:rgba(15,23,42,0.9);padding:16px;border-radius:8px;">${JSON.stringify({ pathname: url.pathname, matchedRules }, null, 2)}</pre></body></html>`;
    const payload = bannerRule ? injectBanner(html, bannerRule) : html;
    return new Response(payload, { status: 200, headers });
  }

  const originUrlString = new URL(
    targetUrl.pathname + targetUrl.search + targetUrl.hash,
    env.ORIGIN_URL
  ).toString();
  const initHeaders = new Headers(request.headers);
  const fetchInit: RequestInit = {
    method: request.method,
    headers: initHeaders
  };
  if (cacheTtl) {
    (fetchInit as RequestInit & { cf?: Record<string, unknown> }).cf = {
      cacheTtl
    };
  }

  const originResponse = await fetch(originUrlString, fetchInit);
  const responseHeaders = new Headers(originResponse.headers);
  headersToRemove.forEach((header) => {
    responseHeaders.delete(header);
  });
  headersToSet.forEach(({ name, value }) => {
    responseHeaders.set(name, value);
  });
  responseHeaders.set(
    "X-Edge-Composer-Version",
    active.versionId ?? "in-memory"
  );
  responseHeaders.set("X-Edge-Composer-Route", selectedRouteLabel);
  if (matchedRules.length) {
    responseHeaders.set(
      "X-Edge-Composer-Rules",
      matchedRules.map((r) => r.type).join(",")
    );
  }

  if (
    bannerRule &&
    /text\/html/i.test(responseHeaders.get("content-type") || "")
  ) {
    const originalHtml = await originResponse.text();
    const injected = injectBanner(originalHtml, bannerRule);
    return new Response(injected, {
      status: originResponse.status,
      headers: responseHeaders
    });
  }

  return new Response(originResponse.body, {
    status: originResponse.status,
    headers: responseHeaders
  });
}

function matchesRulePath(rule: CDNRule, pathname: string): boolean {
  const pattern =
    "path" in rule && typeof (rule as { path?: unknown }).path === "string"
      ? (rule as { path: string }).path
      : "from" in rule && typeof (rule as { from?: unknown }).from === "string"
        ? (rule as { from: string }).from
        : "*";
  if (!pattern) return true;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(pathname);
}

function deterministicRatio(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function injectBanner(html: string, rule: CDNRule): string {
  if (rule.type !== "banner") return html;
  const banner = `<div style="position:fixed;bottom:0;left:0;right:0;padding:12px;background:#134e4a;color:#ecfeff;text-align:center;font-family:system-ui;font-size:14px;">${rule.message}</div>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${banner}</body>`);
  }
  return html + banner;
}
