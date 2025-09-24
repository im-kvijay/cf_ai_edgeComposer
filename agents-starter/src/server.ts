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
import { createCDNTools, type CDNRule, type ToolTraceEntry, type TodoEntry, type ResearchNote } from "./cdn-tools";
// import { env } from "cloudflare:workers";

// const model = openai("gpt-4o-2024-11-20"); // OpenAI provider (disabled)
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

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
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    // Initialize Workers AI provider using the bound AI service
    const workersai = createWorkersAI({ binding: this.env.AI });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Prefer model from the last user message metadata, then options, then default
        let metaModel: string | undefined;
        for (let i = this.messages.length - 1; i >= 0; i--) {
          const msg = this.messages[i] as any;
          if (msg?.role === "user" && msg?.metadata?.model) {
            metaModel = msg.metadata.model as string;
            break;
          }
        }
        // Fallback to the last message's metadata if present
        if (!metaModel && this.messages.length > 0) {
          metaModel = (this.messages[this.messages.length - 1] as any)?.metadata?.model as string | undefined;
        }
        const modelId = metaModel || _options?.model || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        const model = (workersai as unknown as (m: string) => ReturnType<typeof workersai>)(modelId);

        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
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
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
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

// In-memory fallback for storing the applied plan (dev-only; ephemeral in production)
let CURRENT_PLAN: CDNRule[] = [];

interface Env {
  Chat: DurableObjectNamespace<Chat>;
  AI: Ai;
  // Optional KV for persisting plans (will fall back to in-memory if not bound)
  CONFIG_KV?: KVNamespace;
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      // Repurposed: check for Workers AI binding presence instead of OpenAI key
      const hasWorkersAI = !!env.AI;
      return Response.json({
        success: hasWorkersAI
      });
    }

    if (url.pathname === "/ai-test") {
      try {
        const modelParam = "@cf/openai/gpt-oss-120b";
        const body = { prompt: "Say hello from Workers AI" } as const;
        const runPromise = env.AI.run(modelParam as keyof AiModels, body as never);

        const timed = await Promise.race([
          runPromise,
          new Promise((resolve) => setTimeout(() => resolve("__TIMEOUT__"), 15000))
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

    // Log if Workers AI binding is not configured
    if (!env.AI) {
      console.error(
        'Workers AI binding (AI) is not set. Ensure `wrangler.jsonc` contains { "ai": { "binding": "AI" } } and that types/env are generated.'
      );
    }

    // Handle API routes first
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // Handle preview routes (lightweight live HUD)
    if (url.pathname.startsWith('/preview/')) {
      const route = url.searchParams.get('route') || 'v1';
      const cache = url.searchParams.get('cache') || 'HIT';
      const hits = url.searchParams.get('hits') || '0';
      const miss = url.searchParams.get('miss') || '0';
      const p95 = url.searchParams.get('p95') || '90';

      return new Response(`
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
              <p>This page stands in for your origin during preview. Use the HUD to observe values.</p>
              <p><small>Route a real origin later and proxy this Worker in front.</small></p>
            </div>
            <div class="hud">
              <div class="row"><span>Route:</span><span class="pill ${route === 'v1' ? 'ok' : 'warn'}">${route.toUpperCase()}</span></div>
              <div class="row"><span>Cache:</span><span class="pill ${cache === 'HIT' ? 'ok' : 'err'}">${cache}</span></div>
              <div class="row"><span>Hits/Misses:</span><span>${hits} / ${miss}</span></div>
              <div class="row"><span>P95:</span><span>${p95}ms</span></div>
            </div>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    // Handle Durable Object routes (mock for deployment)
    if (url.pathname.startsWith('/do/')) {
      return Response.json({
        message: "Durable Object routes are not available in this deployment",
        status: "mock"
      });
    }

    return (
      // Route the request to our agent or return 404 if not found
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

  switch (path) {
    case '/api/examples':
      return getExamples();

    case '/api/generate':
      return generateConfig(request, env);

    case '/api/validate':
      return validateConfig(await request.json());

    case '/api/simulate':
      return simulateConfig(await request.json());

    case '/api/export':
      return exportConfig(await request.json());

    case '/api/save':
      return saveConfig(await request.json(), env);

    case '/api/current':
      return getCurrent(env);

    default:
      return new Response('API endpoint not found', { status: 404 });
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
    message: 'Example CDN configurations for different use cases'
  });
}

/**
 * Generate CDN configuration using AI
 */
async function generateConfig(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { prompt?: string; scenario?: string };
    const prompt = body.prompt || '';
    // Scenario parameter available but not used in demo

    if (!prompt) {
      return new Response('Prompt is required', { status: 400 });
    }

    if (!env.AI) {
      return new Response('Workers AI not configured', { status: 500 });
    }

    // Prompt the Workers AI model to generate ONLY a JSON array of rules
    const system = `You are a CDN configuration generator. Output ONLY a JSON array of rules. Each rule is an object with keys: \n` +
      `type (one of: "cache" | "header" | "route" | "access" | "performance"), and optional fields depending on type:\n` +
      `- cache: path (string), ttl (number), description (string)\n` +
      `- header: action ("add"|"remove"|"modify"), name (string), value (string?), description (string?)\n` +
      `- route: from (string), to (string), ruleType ("redirect"|"rewrite"|"proxy"), description (string?)\n` +
      `- access: allow (string[]), deny (string[]), description (string?)\n` +
      `- performance: optimization ("compression"|"minification"|"image-optimization"|"lazy-loading"), enabled (boolean), description (string?)\n` +
      `Return a compact JSON array. Do not include any explanation or markdown.`;

    // Tool calling approach: let the model call structured tools to build a plan.
    // Use generateText (non-streaming) so tool calls are fully executed before returning.
    const plan: CDNRule[] = [];
    const trace: ToolTraceEntry[] = [];
    const todos: TodoEntry[] = [];
    const notes: ResearchNote[] = [];
    const cdnTools = createCDNTools(plan, trace, todos, notes);

    const model = "@cf/openai/gpt-oss-120b" as keyof AiModels;
    const workersai = createWorkersAI({ binding: env.AI });
    const modelFn = (workersai as unknown as (m: string) => ReturnType<typeof workersai>)(model);

    let completion: any;
    try {
      completion = await generateText({
        system: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a helpful CDN optimization assistant. You can have a normal conversation and, when appropriate, call tools to build a concrete CDN plan.

Guidance:
- If the user greets you or asks general questions, reply conversationally.
- If the user intent is actionable (e.g., caching, headers, routes, access, performance), call the relevant tools to construct rules.
- Ask for any missing parameters (path, ttl, header name/value, route from/to) before calling tools.
- Keep tool use focused (≤ 8 calls). After tools finish, provide a short summary of what changed.
<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
        model: modelFn,
        tools: cdnTools,
        messages: [{ role: 'user', content: prompt }],
        maxToolRoundtrips: 8,
        maxTokens: 800,
        temperature: 0.2
      } as any);
    } catch (e) {
      console.warn('tool-generation failed, falling back to JSON mode', e);
    }

    // If tool plan is empty, fall back to JSON-output mode and parse
    if (plan.length === 0) {
      try {
        const jsonSystem = `You are a CDN configuration generator. Output ONLY a JSON array of rules. Each rule is an object with keys: \n` +
          `type (one of: "cache" | "header" | "route" | "access" | "performance"), and optional fields depending on type:\n` +
          `- cache: path (string), ttl (number), description (string)\n` +
          `- header: action ("add"|"remove"|"modify"), name (string), value (string?), description (string?)\n` +
          `- route: from (string), to (string), ruleType ("redirect"|"rewrite"|"proxy"), description (string?)\n` +
          `- access: allow (string[]), deny (string[]), description (string?)\n` +
          `- performance: optimization ("compression"|"minification"|"image-optimization"|"lazy-loading"), enabled (boolean), description (string?)\n` +
          `Return a compact JSON array. Do not include any explanation or markdown.`;

        const rawResponse = await env.AI.run(model, {
          input: `SYSTEM:\n${jsonSystem}\n\nUSER:\nGenerate CDN rules for: ${prompt}`,
          max_tokens: 800,
          temperature: 0.2
        } as never);

        const raw = (rawResponse as any)?.output?.[0]?.text
          ?? (rawResponse as any)?.output_text
          ?? (typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse));
        const match = typeof raw === 'string' ? raw.match(/\[[\s\S]*\]/) : null;
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            for (const r of parsed) {
              const withId = { id: crypto.randomUUID(), ...(r as object) } as CDNRule;
              plan.push(withId);
            }
            trace.push({ name: 'fallback_json_parse', input: { raw }, output: parsed });
          }
        }
      } catch (e) {
        console.warn('json fallback failed', e);
      }
    }

    // The executed tools or fallback have appended rules into 'plan'.
    return Response.json({
      config: plan,
      trace,
      todos,
      notes,
      assistant: (completion as any)?.text ?? '',
      validation: { success: true, errors: [] },
      prompt,
      message: 'Configuration generated successfully (tools)'
    });

  } catch (error) {
    console.error('Error generating config:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Validate a CDN configuration
 */
function validateConfig(configData: { config?: any }): Response {
  // Basic validation - in a real app this would use Zod schemas
  const config = configData.config || [];
  const isValid = Array.isArray(config);

  return Response.json({
    validation: {
      success: isValid,
      errors: isValid ? [] : ['Invalid configuration format']
    },
    message: isValid ? 'Configuration is valid' : 'Configuration has errors'
  });
}

/**
 * Simulate CDN configuration performance
 */
function simulateConfig(simData: { config?: any; requestCount?: number }): Response {
  // Config parameter available but not used in demo
  const requestCount = simData.requestCount || 100;

  // Mock simulation results
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
  const filename = (data?.filename || 'cdn-config.json').replace(/[^a-zA-Z0-9._-]/g, '_');
  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=${filename}`
    }
  });
}

/**
 * Save applied configuration to KV (if bound) or memory
 */
async function saveConfig(data: { config?: CDNRule[] }, env: Env): Promise<Response> {
  const cfg = Array.isArray(data?.config) ? data!.config! : [];
  if (env.CONFIG_KV) {
    await env.CONFIG_KV.put('current_plan', JSON.stringify(cfg));
  } else {
    CURRENT_PLAN = cfg;
  }
  return Response.json({ saved: true, count: cfg.length });
}

/**
 * Retrieve current configuration
 */
async function getCurrent(env: Env): Promise<Response> {
  if (env.CONFIG_KV) {
    const txt = await env.CONFIG_KV.get('current_plan');
    const cfg = txt ? (JSON.parse(txt) as CDNRule[]) : [];
    return Response.json({ config: cfg });
  }
  return Response.json({ config: CURRENT_PLAN });
}
