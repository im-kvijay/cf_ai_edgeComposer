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
  type ToolSet
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
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

interface Env {
  Chat: DurableObjectNamespace<Chat>;
  AI: Ai;
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
        const modelParam = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
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

    // Handle preview routes (mock for deployment)
    if (url.pathname.startsWith('/preview/')) {
      return new Response(`
        <html>
          <head><title>CDN Preview</title></head>
          <body style="font-family: system-ui, sans-serif; padding: 20px;">
            <h1>CDN Configuration Preview</h1>
            <p>This is a preview of how the CDN configuration would be applied.</p>
            <p><strong>Path:</strong> ${url.pathname}</p>
            <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px;">
              <strong>Preview Mode Active</strong><br>
              Route: v1<br>
              Cache Status: HIT<br>
              Response Time: ~85ms
            </div>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
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

    // For demo, return a mock response
    const mockConfig = [
      {
        type: "cache",
        path: "/api/*",
        ttl: 300,
        description: "Cache API responses for 5 minutes"
      },
      {
        type: "header",
        action: "add",
        name: "X-CDN-Optimized",
        value: "true",
        description: "Add optimization header"
      }
    ];

    return Response.json({
      config: mockConfig,
      validation: { success: true, errors: [] },
      prompt: prompt,
      message: 'Configuration generated successfully'
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
