# edgeComposer

## Summary

- This is an AI-powered Content Delivery Network (CDN) optimization program.
- It serves to create and test CDN rules from your natural language input via Llama 3.3 70B served on cloudflare-workers.
- You can view risk metrics, insights, and even export your rules through this program.
- Built on top of the starter agents-starter github repository created by cloudflare.

## Frontend

- Aims to be clean and insightful with risk metrics, plan insights (summary, validation, etc), rule diff, preset playbooks, and preview token management.

## Backend

- Workers runtime (src/server.ts) orchestrates Llama 3.3 calls via Workers AI, manages tool execution to mutate a shared plan array, falls back to JSON repair if the model skips tools, and renders preview responses.

## State/control plane

- ConfigDO Durable Object (src/config-do.ts) persists drafts, promotions, history, tokens, and simulations.
- Includes an in-memory fallback for local dev.

## Tool suite

- src/cdn-tools.ts defines over 25 typed tools for the LLM to call(cache/header/route/access/performance/image/rate-limit/bot/security/canary/banner/origin-shield/transform) plus utilities (validate, dedupe, risk scoring, todo, research notes).

## What can it do

- Chat driven config – Uses Llama 3.3 with multi tool roundtrips to gather requirements, call typed tools, summarize and score risk.
- Fallback repair – Hardened JSON extractor repairs malformed model output to avoid dead ends.
- Plan lifecycle – /api/plan, /api/simulate, /api/promote, /api/rollback, /api/versions, /api/token endpoints manage drafts, history, versions, and preview tokens.
- Risk audit – Deterministic scoring + a second LLM pass that produces a narrative audit and overrides the numeric classification when needed.
- Playbooks – Preset scenarios inject curated rules and track steps (generate, review, apply) with automatic current-plan promotion during the “Apply changes” step.
- Simulate – Diff vs. active plan, synthetic metrics, guardrail warnings, todos.
- Rule diff & details – Human readable current vs. proposed diff, rule details panel with quick reset/update/remove actions.

# How to use

## Via deployed link (recommended)

https://agents-starter.krishna0-vijay0.workers.dev/

- Set ORIGIN_URL to get traffic proxied to backend, but can be left empty if you have no test URL to point at. Code will simply skip that functionality and show a preview.
- It can be set via the cog icon found in the top menu bar.
- Mess around!

## Locally

Run the following commands in a folder you are comfortable installing this repo into.

```
git clone https://github.com/im-kvijay/cf_ai_edgeComposer.git
cd cf_ai_edgeComposer/agents-starter
./scripts/reset-dev.sh
```

You should now see a locally running instance in your browser.

- IMPORTANT:
  - If you have not logged into wrangler, there will be no LLM connection and the code will be mostly nonfunctional (although you can still preview it without logging in.)

Run the following command if you want full functionality.

```
npx wrangler login
```

# Referenced documents

- https://www.llama.com/docs/model-cards-and-prompt-formats/llama3_3/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/#2-connect-your-worker-to-workers-ai
- https://developers.cloudflare.com/agents/?utm_content=agents.cloudflare.com
- https://blog.cloudflare.com/deploy-your-own-ai-vibe-coding-platform/
- https://github.com/openai/harmony
- https://github.com/openai/gpt-oss?tab=readme-ov-file
