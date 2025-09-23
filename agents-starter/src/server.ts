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


    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
