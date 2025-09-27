import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
// Could import any other source file/function here
import worker from "../src/server";

declare module "cloudflare:test" {
  // Controls the type of `import("cloudflare:test").env`
  interface ProvidedEnv extends Env {}
}

describe("Chat worker", () => {
  it("serves the preview page", async () => {
    const request = new Request("http://example.com");
    // Create an empty context to pass to `worker.fetch()`
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("Edge Composer Preview");
  });
});
