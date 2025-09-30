import { DurableObject } from "cloudflare:workers";
import { createDefaultPlanVersion } from "@/default-plan";
import type {
  EdgePlan,
  EdgePlanVersion,
  PreviewTokenState,
  CDNRule
} from "@/shared-types";

type DurableState = ConstructorParameters<typeof DurableObject>[0];

const VERSION_PREFIX = "version:" as const;
const TOKEN_PREFIX = "token:" as const;
const ACTIVE_KEY = "active" as const;
const DRAFT_KEY = "draft" as const;
const ORIGIN_KEY = "origin" as const;

interface SavePlanRequest {
  plan: EdgePlan;
  description?: string;
  promotedBy?: string;
}

interface PromoteRequest {
  versionId?: string;
  promotedBy?: string;
  description?: string;
}

interface RollbackRequest {
  versionId: string;
  promotedBy?: string;
}

interface CreateTokenRequest {
  versionId: string;
  expiresInSeconds?: number;
}

export class ConfigDO extends DurableObject {
  private readonly state: DurableState;

  constructor(state: DurableState, env: Env) {
    super(state, env);
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method.toUpperCase();

    await this.ensureSeedPlan();

    if (path.startsWith("/preview/")) {
      return this.handlePreview(request, path);
    }

    try {
      if (method === "GET") {
        if (path === "" || path === "/")
          return new Response("Config DO", { status: 200 });
        if (path === "/active") return this.getActive();
        if (path === "/draft") return this.getDraft();
        if (path === "/versions") return this.listVersions();
        if (path.startsWith("/versions/")) {
          const id = path.split("/")[2];
          return this.getVersion(id);
        }
        if (path === "/tokens") return this.listTokens();
        if (path === "/origin") return this.getOrigin();
      }

      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (path === "/plan") return this.saveDraft(body as SavePlanRequest);
        if (path === "/promote")
          return this.promoteVersion(body as PromoteRequest);
        if (path === "/rollback")
          return this.rollbackVersion(body as RollbackRequest);
        if (path === "/token")
          return this.createToken(body as CreateTokenRequest);
        if (path === "/simulate")
          return this.simulatePlan(
            body as { plan: EdgePlan; currentVersionId?: string }
          );
        if (path === "/origin")
          return this.setOrigin(body as { origin?: string });
      }

      if (method === "DELETE" && path.startsWith("/token/")) {
        const token = path.split("/")[2];
        return this.deleteToken(token);
      }

      if (method === "DELETE" && path === "/origin") {
        return this.clearOrigin();
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "config_do_error",
          message: error instanceof Error ? error.message : String(error)
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  }

  private async ensureSeedPlan() {
    const active = await this.state.storage.get<EdgePlanVersion>(ACTIVE_KEY);
    if (active) return;

    const seed = createDefaultPlanVersion();
    await Promise.all([
      this.state.storage.put(ACTIVE_KEY, seed),
      this.state.storage.put(`${VERSION_PREFIX}${seed.id}`, seed)
    ]);
  }

  private async getActive(): Promise<Response> {
    const active = await this.state.storage.get<EdgePlanVersion>(ACTIVE_KEY);
    return Response.json({ active });
  }

  private async getDraft(): Promise<Response> {
    const draft = await this.state.storage.get<EdgePlanVersion>(DRAFT_KEY);
    return Response.json({ draft });
  }

  private async listVersions(): Promise<Response> {
    const entries = await this.state.storage.list<EdgePlanVersion>({
      prefix: VERSION_PREFIX
    });
    const versions = Array.from(entries.values()).filter(
      Boolean
    ) as EdgePlanVersion[];
    versions.sort(
      (a, b) =>
        new Date(b.plan.createdAt).getTime() -
        new Date(a.plan.createdAt).getTime()
    );
    return Response.json({ versions });
  }

  private async getVersion(versionId: string): Promise<Response> {
    const version = await this.state.storage.get<EdgePlanVersion>(
      `${VERSION_PREFIX}${versionId}`
    );
    if (!version) {
      return Response.json({ message: "Version not found" }, { status: 404 });
    }
    return Response.json({ version });
  }

  private async saveDraft(body: SavePlanRequest): Promise<Response> {
    const now = new Date().toISOString();
    const plan: EdgePlan = body.plan ?? {
      id: crypto.randomUUID(),
      rules: [],
      createdAt: now
    };
    const draftVersion: EdgePlanVersion = {
      id: plan.id,
      plan: { ...plan, createdAt: plan.createdAt ?? now },
      description: body.description,
      promotedBy: body.promotedBy
    };
    await this.state.storage.put(DRAFT_KEY, draftVersion);
    return Response.json({ draft: draftVersion, message: "Draft saved" });
  }

  private async promoteVersion(body: PromoteRequest): Promise<Response> {
    const now = new Date().toISOString();
    let version: EdgePlanVersion | undefined;

    if (body.versionId) {
      version = await this.state.storage.get<EdgePlanVersion>(
        `${VERSION_PREFIX}${body.versionId}`
      );
      if (!version) {
        return Response.json({ error: "version_not_found" }, { status: 404 });
      }
    } else {
      version = await this.state.storage.get<EdgePlanVersion>(DRAFT_KEY);
      if (!version) {
        return Response.json({ error: "draft_not_found" }, { status: 404 });
      }
      version = {
        ...version,
        id: crypto.randomUUID(),
        description: body.description ?? version.description,
        promotedBy: body.promotedBy ?? version.promotedBy
      };
    }

    const promoted: EdgePlanVersion = {
      ...version,
      promotedAt: now,
      promotedBy: body.promotedBy ?? version.promotedBy,
      description: body.description ?? version.description
    };

    await this.state.storage.put(`${VERSION_PREFIX}${promoted.id}`, promoted);
    await this.state.storage.put(ACTIVE_KEY, promoted);
    await this.state.storage.delete(DRAFT_KEY);

    return Response.json({ active: promoted, message: "Plan promoted" });
  }

  private async rollbackVersion(body: RollbackRequest): Promise<Response> {
    const version = await this.state.storage.get<EdgePlanVersion>(
      `${VERSION_PREFIX}${body.versionId}`
    );
    if (!version) {
      return Response.json({ error: "version_not_found" }, { status: 404 });
    }
    const rolledBack: EdgePlanVersion = {
      ...version,
      promotedAt: new Date().toISOString(),
      promotedBy: body.promotedBy ?? version.promotedBy
    };
    await this.state.storage.put(ACTIVE_KEY, rolledBack);
    return Response.json({ active: rolledBack, message: "Rollback complete" });
  }

  private async listTokens(): Promise<Response> {
    const tokens = await this.state.storage.list<PreviewTokenState>({
      prefix: TOKEN_PREFIX
    });
    return Response.json({
      tokens: Array.from(tokens.values()).filter(Boolean)
    });
  }

  private async getOrigin(): Promise<Response> {
    const origin = await this.state.storage.get<string>(ORIGIN_KEY);
    return Response.json({
      origin: typeof origin === "string" ? origin : null
    });
  }

  private async setOrigin(body: { origin?: string }): Promise<Response> {
    const raw = typeof body.origin === "string" ? body.origin.trim() : "";
    if (!raw) {
      await this.state.storage.delete(ORIGIN_KEY);
      return Response.json({ origin: null });
    }
    await this.state.storage.put(ORIGIN_KEY, raw);
    return Response.json({ origin: raw });
  }

  private async clearOrigin(): Promise<Response> {
    await this.state.storage.delete(ORIGIN_KEY);
    return Response.json({ origin: null });
  }

  private async createToken(body: CreateTokenRequest): Promise<Response> {
    const version = await this.state.storage.get<EdgePlanVersion>(
      `${VERSION_PREFIX}${body.versionId}`
    );
    if (!version) {
      return Response.json({ error: "version_not_found" }, { status: 404 });
    }
    const token = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = body.expiresInSeconds
      ? new Date(now + body.expiresInSeconds * 1000).toISOString()
      : undefined;
    const record: PreviewTokenState = {
      token,
      versionId: version.id,
      createdAt: new Date(now).toISOString(),
      expiresAt
    };
    await this.state.storage.put(`${TOKEN_PREFIX}${token}`, record);
    return Response.json({ token: record });
  }

  private async deleteToken(token: string): Promise<Response> {
    await this.state.storage.delete(`${TOKEN_PREFIX}${token}`);
    return Response.json({ token, deleted: true });
  }

  private async simulatePlan(body: {
    plan: EdgePlan;
    currentVersionId?: string;
  }): Promise<Response> {
    const current = body.currentVersionId
      ? await this.state.storage.get<EdgePlanVersion>(
          `${VERSION_PREFIX}${body.currentVersionId}`
        )
      : await this.state.storage.get<EdgePlanVersion>(ACTIVE_KEY);

    const proposedRules = body.plan.rules ?? [];
    const currentRules = current?.plan.rules ?? [];

    const keyFor = (rule: CDNRule) => {
      const base = { ...rule } as Record<string, unknown>;
      delete base.id;
      const descriptor =
        typeof base.path === "string"
          ? (base.path as string)
          : typeof base.from === "string"
            ? (base.from as string)
            : JSON.stringify(base);
      return `${rule.type}:${descriptor}`;
    };

    const proposedMap = new Map<string, CDNRule>();
    for (const rule of proposedRules) proposedMap.set(keyFor(rule), rule);
    const currentMap = new Map<string, CDNRule>();
    for (const rule of currentRules) currentMap.set(keyFor(rule), rule);

    const added: CDNRule[] = [];
    const removed: CDNRule[] = [];
    const changed: { before: CDNRule; after: CDNRule }[] = [];

    for (const [key, rule] of proposedMap) {
      if (!currentMap.has(key)) {
        added.push(rule);
      } else {
        const baseline = currentMap.get(key)!;
        if (
          JSON.stringify({ ...baseline, id: undefined }) !==
          JSON.stringify({ ...rule, id: undefined })
        ) {
          changed.push({ before: baseline, after: rule });
        }
      }
    }

    for (const [key, rule] of currentMap) {
      if (!proposedMap.has(key)) removed.push(rule);
    }

    const routeRules = proposedRules.filter((r) => r.type === "route").length;
    const canaryRules = proposedRules.filter((r) => r.type === "canary").length;
    const bannerRules = proposedRules.filter((r) => r.type === "banner").length;

    const baselineLatency = 90;
    const latencyDelta =
      routeRules * 3 +
      canaryRules * 5 +
      bannerRules * 2 +
      (added.length - removed.length) * 1.5;
    const estimatedP95 = Math.max(
      40,
      Math.round(baselineLatency + latencyDelta)
    );
    const estimatedP50 = Math.max(20, Math.round(estimatedP95 * 0.55));
    const estimatedErrorRate = Math.max(
      0,
      Math.min(0.2, canaryRules * 0.01 + changed.length * 0.005)
    );

    const summaryParts: string[] = [];
    if (added.length)
      summaryParts.push(
        `${added.length} new rule${added.length === 1 ? "" : "s"}`
      );
    if (removed.length) summaryParts.push(`${removed.length} removed`);
    if (changed.length) summaryParts.push(`${changed.length} modified`);
    if (!summaryParts.length)
      summaryParts.push("No structural changes detected");

    return Response.json({
      summary: summaryParts.join(", "),
      comparedAgainst: current?.id ?? null,
      requestedPlan: body.plan,
      diff: {
        added,
        removed,
        changed
      },
      metrics: {
        requestsEvaluated: 100,
        p50: estimatedP50,
        p95: estimatedP95,
        estimatedErrorRate
      }
    });
  }

  private async handlePreview(
    _request: Request,
    path: string
  ): Promise<Response> {
    const [, , token, ...rest] = path.split("/");
    if (!token) {
      return new Response("Missing preview token", { status: 400 });
    }
    const tokenState = await this.state.storage.get<PreviewTokenState>(
      `${TOKEN_PREFIX}${token}`
    );
    if (!tokenState) {
      return new Response("Preview token not found", { status: 404 });
    }
    if (tokenState.expiresAt && Date.now() > Date.parse(tokenState.expiresAt)) {
      await this.state.storage.delete(`${TOKEN_PREFIX}${token}`);
      return new Response("Preview token expired", { status: 410 });
    }
    const version = await this.state.storage.get<EdgePlanVersion>(
      `${VERSION_PREFIX}${tokenState.versionId}`
    );
    const previewPath = `/${rest.join("/")}`;
    return new Response(
      `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>EdgeComposer Preview</title>
            <style>
              body { font-family: system-ui, sans-serif; margin: 0; padding: 32px; background: #0f1729; color: #f8fafc; }
              .card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 12px; padding: 24px; max-width: 720px; margin: 0 auto; }
              .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(96, 165, 250, 0.2); color: #60a5fa; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
              pre { background: rgba(15, 23, 42, 0.95); color: #e2e8f0; padding: 16px; border-radius: 8px; font-size: 13px; overflow: auto; }
            </style>
          </head>
          <body>
            <div class="card">
              <span class="badge">Preview Token</span>
              <h1 style="margin-top: 16px;">Edge Configuration Preview</h1>
              <p>You are viewing version <strong>${tokenState.versionId}</strong> using preview token <code>${token}</code>.</p>
              <p>Requested path: <code>${previewPath}</code></p>
              <h2 style="margin-top: 32px;">Plan Summary</h2>
              <pre>${version ? JSON.stringify(version.plan, null, 2) : "Version not found"}</pre>
            </div>
          </body>
        </html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
}
