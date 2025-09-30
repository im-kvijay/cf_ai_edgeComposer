/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea/Textarea";
import { Loader } from "@/components/loader/Loader";
import { RuleDetailsPanel } from "@/components/rules/RuleDetailsPanel";
import { PlaybooksPanel } from "@/components/playbooks/PlaybooksPanel";
import { ChatView } from "@/components/chat/ChatView";
import { cloneDefaultRules } from "@/default-plan";
import {
  extractRulePath,
  formatKeyLabel,
  renderSummarySection,
  summarizeValue
} from "@/lib/presenters";
import type {
  CDNPlan,
  ChatMessage,
  GenerateResponse,
  PlanInsights,
  PreviewMetrics
} from "@/types/app";
import type {
  PlaybookState,
  PlaybookStep,
  CDNRule,
  TodoEntry,
  ResearchNote,
  EdgePlanVersion,
  PreviewTokenState
} from "@/shared-types";

import {
  Moon,
  Sun,
  Play,
  CheckCircle,
  ArrowRight,
  ArrowClockwise,
  Gear
} from "@phosphor-icons/react";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export default function CDNConfigurator() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });

  const [currentPlan, setCurrentPlan] = useState<CDNPlan>({
    rules: cloneDefaultRules()
  });
  const [proposedPlan, setProposedPlan] = useState<CDNPlan | null>(null);
  const [previewMetrics, _setPreviewMetrics] = useState<PreviewMetrics>({
    version: "v1.0",
    route: "v1",
    cacheStatus: "HIT",
    hitCount: 145,
    missCount: 23,
    p95Latency: 89
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [todos, setTodos] = useState<TodoEntry[]>([]);
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [activeRuleIndex, setActiveRuleIndex] = useState<number | null>(null);
  const [playbookState, setPlaybookState] = useState<PlaybookState | null>(
    null
  );
  const [planInsights, setPlanInsights] = useState<PlanInsights | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<
    Array<{ id: string; description?: string; promotedAt?: string }>
  >([]);
  const [previewTokens, setPreviewTokens] = useState<
    Array<{
      token: string;
      versionId: string;
      createdAt: string;
      expiresAt?: string;
    }>
  >([]);
  const [originOverride, setOriginOverride] = useState<string | null>(null);
  const [originInput, setOriginInput] = useState("");
  const [isSavingOrigin, setIsSavingOrigin] = useState(false);
  const [isLoadingOrigin, setIsLoadingOrigin] = useState(true);
  const [originError, setOriginError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const refreshVersions = useCallback(async () => {
    try {
      const res = await fetch("/api/versions");
      if (res.ok) {
        const data = (await res.json()) as { versions?: EdgePlanVersion[] };
        if (Array.isArray(data.versions)) {
          setAvailableVersions(
            data.versions.map((version) => ({
              id: version.id,
              description: version.description,
              promotedAt: version.promotedAt
            }))
          );
        }
      }
    } catch (err) {
      console.error("load versions failed", err);
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens");
      if (res.ok) {
        const data = (await res.json()) as { tokens?: PreviewTokenState[] };
        if (Array.isArray(data.tokens)) {
          setPreviewTokens(
            data.tokens.map((token) => ({
              token: token.token,
              versionId: token.versionId,
              createdAt: token.createdAt,
              expiresAt: token.expiresAt
            }))
          );
        }
      }
    } catch (err) {
      console.error("load tokens failed", err);
    }
  }, []);

  const submitOriginOverride = useCallback(async (value: string | null) => {
    setIsSavingOrigin(true);
    setOriginError(null);
    try {
      const trimmed = value && value.trim().length > 0 ? value.trim() : null;
      const res = await fetch("/api/origin", {
        method: trimmed ? "POST" : "DELETE",
        headers: trimmed ? { "Content-Type": "application/json" } : undefined,
        body: trimmed ? JSON.stringify({ origin: trimmed }) : undefined
      });
      if (!res.ok) {
        throw new Error(`origin update failed: ${res.status}`);
      }
      const data = (await res.json()) as { origin?: string | null };
      const origin =
        typeof data.origin === "string" && data.origin.trim().length > 0
          ? data.origin.trim()
          : null;
      setOriginOverride(origin);
      setOriginInput(origin ?? "");
      return true;
    } catch (err) {
      console.error("origin update failed", err);
      setOriginError("Unable to update preview origin.");
      return false;
    } finally {
      setIsSavingOrigin(false);
    }
  }, []);

  const riskLevel = planInsights?.risk?.classification;
  const riskScore = planInsights?.risk?.score;
  const riskReasons = planInsights?.risk?.reasons ?? [];
  const riskAudit = planInsights?.riskAudit ?? null;
  const riskTone = (() => {
    switch (riskLevel) {
      case "high":
        return "text-red-600 dark:text-red-300";
      case "elevated":
        return "text-orange-600 dark:text-orange-300";
      case "moderate":
        return "text-amber-600 dark:text-amber-300";
      case "low":
        return "text-green-600 dark:text-green-300";
      default:
        return "text-neutral-600 dark:text-neutral-300";
    }
  })();
  const validationWarnings = planInsights?.validation?.warnings ?? [];
  const validationErrors = planInsights?.validation?.errors ?? [];

  function makeId() {
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).slice(2);
    }
  }

  const pushMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  function presetRulesForScenario(
    scenario: PlaybookState["scenario"]
  ): CDNPlan["rules"] {
    const build = <TRule extends CDNRule>(rule: TRule): CDNRule => rule;
    switch (scenario) {
      case "ecommerce":
        return [
          build({
            id: makeId(),
            type: "cache",
            path: "/images/*",
            ttl: 86_400,
            description: "Cache product images for 24h"
          }),
          build({
            id: makeId(),
            type: "performance",
            optimization: "compression",
            enabled: true,
            description: "Enable gzip/brotli"
          }),
          build({
            id: makeId(),
            type: "header",
            action: "add",
            name: "Cache-Control",
            value: "public, max-age=86400",
            description: "Cache header for static assets"
          }),
          build({
            id: makeId(),
            type: "canary",
            path: "/checkout/*",
            primaryOrigin: "primary",
            canaryOrigin: "checkout-v2",
            percentage: 0.1,
            stickyBy: "cookie",
            metricGuardrail: {
              metric: "latency",
              operator: "lt",
              threshold: 350
            },
            description: "Canary checkout edge"
          }),
          build({
            id: makeId(),
            type: "banner",
            path: "/",
            message: "Spring sale ships in 2 days",
            style: { tone: "mint", theme: "auto" },
            schedule: {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 86_400_000).toISOString(),
              timezone: "UTC"
            },
            audience: { segment: "guest" },
            description: "Campaign banner"
          })
        ];
      case "blog":
        return [
          build({
            id: makeId(),
            type: "cache",
            path: "/assets/*",
            ttl: 604_800,
            description: "Cache static assets for 7d"
          }),
          build({
            id: makeId(),
            type: "header",
            action: "add",
            name: "Cache-Control",
            value: "public, max-age=604800",
            description: "Long cache for assets"
          }),
          build({
            id: makeId(),
            type: "performance",
            optimization: "minification",
            enabled: true,
            description: "Minify HTML/CSS/JS"
          }),
          build({
            id: makeId(),
            type: "banner",
            path: "/blog/*",
            message: "Scheduled maintenance Sunday 01:00 UTC",
            style: { tone: "warning", theme: "dark" },
            schedule: {
              start: new Date().toISOString(),
              end: new Date(Date.now() + 48 * 3_600 * 1_000).toISOString(),
              timezone: "UTC"
            },
            audience: { segment: "beta" },
            description: "Maintenance notice"
          })
        ];
      case "api":
        return [
          build({
            id: makeId(),
            type: "header",
            action: "add",
            name: "Cache-Control",
            value: "no-store",
            description: "Do not cache API responses"
          }),
          build({
            id: makeId(),
            type: "performance",
            optimization: "compression",
            enabled: true,
            description: "Compress API responses"
          }),
          build({
            id: makeId(),
            type: "rate-limit",
            path: "/api/*",
            requestsPerMinute: 600,
            burst: 100,
            action: "challenge",
            description: "Basic rate limit"
          }),
          build({
            id: makeId(),
            type: "origin-shield",
            origins: ["primary", "backup"],
            tieredCaching: "regional",
            healthcheck: {
              path: "/health",
              intervalSeconds: 60,
              timeoutMs: 2_000
            },
            description: "Shield API origins"
          }),
          build({
            id: makeId(),
            type: "canary",
            path: "/api/*",
            primaryOrigin: "api-v1",
            canaryOrigin: "api-v2",
            percentage: 0.05,
            stickyBy: "header",
            metricGuardrail: {
              metric: "error_rate",
              operator: "lt",
              threshold: 0.03
            },
            description: "Edge API canary"
          })
        ];
      case "static":
        return [
          build({
            id: makeId(),
            type: "cache",
            path: "/assets/*",
            ttl: 31_536_000,
            description: "Cache static assets for 1y"
          }),
          build({
            id: makeId(),
            type: "header",
            action: "add",
            name: "Cache-Control",
            value: "public, max-age=31536000, immutable",
            description: "Immutable cache for hashed assets"
          }),
          build({
            id: makeId(),
            type: "route",
            from: "/app/*",
            to: "/app/index.html",
            ruleType: "rewrite",
            description: "SPA fallback"
          }),
          build({
            id: makeId(),
            type: "transform",
            path: "/",
            phase: "response",
            action: {
              kind: "html-inject",
              position: "head-end",
              markup: '<meta name="edge-composer" content="static-theme" />'
            },
            description: "Inject preview meta"
          })
        ];
      default:
        return [];
    }
  }
  async function runPlaybook(playbookId: string): Promise<PlaybookState> {
    const knownScenarios: PlaybookState["scenario"][] = [
      "ecommerce",
      "blog",
      "api",
      "static",
      "custom"
    ];
    const scenario = knownScenarios.includes(
      playbookId as PlaybookState["scenario"]
    )
      ? (playbookId as PlaybookState["scenario"])
      : "custom";
    const rules = presetRulesForScenario(scenario);
    setProposedPlan({ rules });
    setPlanInsights(null);
    const steps: PlaybookStep[] = [
      { id: makeId(), title: "Generate preset rules", status: "completed" },
      {
        id: makeId(),
        title: "Review proposed configuration",
        status: "pending"
      },
      { id: makeId(), title: "Apply changes", status: "pending" }
    ];
    const playbook: PlaybookState = {
      id: makeId(),
      title: `${scenario} preset`,
      scenario,
      steps,
      activeStepIndex: 1,
      startedAt: new Date().toISOString()
    };
    setPlaybookState(playbook);
    return playbook;
  }

  async function advancePlaybookStep(): Promise<PlaybookState | null> {
    if (!playbookState) return null;
    const idx = playbookState.activeStepIndex;
    const currentStep = playbookState.steps[idx];
    const steps: PlaybookStep[] = playbookState.steps.map((step, index) => ({
      ...step,
      status: index <= idx ? "completed" : step.status
    }));
    const nextIndex = Math.min(idx + 1, steps.length);
    const updated: PlaybookState = {
      ...playbookState,
      steps,
      activeStepIndex: nextIndex,
      completedAt:
        nextIndex >= steps.length ? new Date().toISOString() : undefined
    };
    setPlaybookState(updated);
    if (currentStep && /apply/i.test(currentStep.title) && proposedPlan) {
      setCurrentPlan({ rules: proposedPlan.rules });
      setProposedPlan(null);
      setDraftVersionId(null);
      setPlanInsights(null);
    }
    return updated;
  }

  async function resetRule(ruleIndex: number) {
    const copy = [...currentPlan.rules];
    const existing = copy[ruleIndex];
    if (!existing) return copy;
    const stripped = { ...existing } as CDNRule & { description?: string };
    delete stripped.description;
    copy[ruleIndex] = stripped;
    return copy;
  }

  async function updateRule(ruleIndex: number, patch: Partial<CDNRule>) {
    const copy = [...currentPlan.rules];
    const existing = copy[ruleIndex];
    if (!existing) return copy;
    const merged = { ...existing, ...patch } as CDNRule;
    copy[ruleIndex] = merged;
    return copy;
  }

  async function removeRule(ruleIndex: number) {
    const copy = [...currentPlan.rules];
    copy.splice(ruleIndex, 1);
    return copy;
  }

  useEffect(() => {
    (async () => {
      try {
        const [activeRes, draftRes] = await Promise.all([
          fetch("/api/active"),
          fetch("/api/draft")
        ]);

        if (activeRes.ok) {
          const data = (await activeRes.json()) as {
            active?: EdgePlanVersion | null;
          };
          const active = data?.active;
          if (active?.plan?.rules) {
            setCurrentPlan({ rules: active.plan.rules });
            setActiveVersionId(active.id ?? null);
          }
        }

        if (draftRes.ok) {
          const data = (await draftRes.json()) as {
            draft?: EdgePlanVersion | null;
          };
          const draft = data?.draft;
          if (draft?.plan?.rules) {
            setProposedPlan({ rules: draft.plan.rules });
            setDraftVersionId(draft.id ?? null);
          }
        }

        await Promise.all([refreshVersions(), refreshTokens()]);
      } catch (err) {
        console.error("bootstrap fetch failed", err);
      }
    })();
  }, [refreshVersions, refreshTokens]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/origin");
        if (res.ok) {
          const data = (await res.json()) as { origin?: string | null };
          const origin =
            typeof data.origin === "string" && data.origin.trim().length > 0
              ? data.origin.trim()
              : null;
          setOriginOverride(origin);
          setOriginInput(origin ?? "");
        }
      } catch (err) {
        console.error("load origin failed", err);
      } finally {
        setIsLoadingOrigin(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const [input, setInput] = useState("");
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleOriginSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const ok = await submitOriginOverride(originInput);
      if (ok) setIsSettingsOpen(false);
    },
    [originInput, submitOriginOverride]
  );

  const handleOriginClear = useCallback(async () => {
    setOriginInput("");
    const ok = await submitOriginOverride(null);
    if (ok) setIsSettingsOpen(false);
  }, [submitOriginOverride]);

  const handleOriginInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setOriginInput(event.target.value);
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      pushMessage({ id: makeId(), role: "user", text: input });
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input })
      });
      if (!res.ok) {
        console.error("Generate failed", res.status);
        pushMessage({
          id: makeId(),
          role: "assistant",
          text: `There was an error generating a plan (HTTP ${res.status}). Please try a more specific request.`
        });
        return;
      }
      const data = (await res.json()) as GenerateResponse;
      const rules = Array.isArray(data.config)
        ? enrichRulesWithIds(data.config)
        : [];
      setProposedPlan({ rules });
      setPlanInsights(data.insights ?? null);
      if (typeof data.draftVersionId === "string") {
        setDraftVersionId(data.draftVersionId);
      }
      if (data.assistant) {
        pushMessage({ id: makeId(), role: "assistant", text: data.assistant });
      }
      if (Array.isArray(data.trace)) {
        const toolMsgs: ChatMessage[] = data.trace.map((entry) => {
          const title = entry.label || entry.id;
          const ok = entry.status === "success";
          const summary = `${ok ? "OK" : "ERR"} ${title}`;
          return {
            id: entry.id || makeId(),
            role: "tool" as const,
            summary,
            details: {
              status: entry.status,
              input: entry.input,
              output: entry.output,
              startedAt: entry.startedAt,
              finishedAt: entry.finishedAt
            }
          };
        });
        if (toolMsgs.length) {
          setMessages((prev) => [...prev, ...toolMsgs]);
        }
      }
      if (Array.isArray(data.todos)) setTodos(data.todos);
      if (Array.isArray(data.notes)) setNotes(data.notes);
      if (data.playbook) setPlaybookState(data.playbook);
    } catch (err) {
      console.error("Generate error", err);
      pushMessage({
        id: makeId(),
        role: "assistant",
        text: "I hit an error generating the plan. Please try again."
      });
      setPlanInsights(null);
    } finally {
      setInput("");
      setIsGenerating(false);
    }
  };

  const enrichRulesWithIds = (
    rules: Array<Partial<CDNRule>>
  ): CDNPlan["rules"] => {
    return rules.map((rule) => ({
      ...rule,
      id: rule.id ?? makeId()
    })) as CDNPlan["rules"];
  };

  const applyChanges = async () => {
    if (!draftVersionId) return;
    try {
      const res = await fetch("/api/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: draftVersionId })
      });
      if (!res.ok) return;
      const data: { active?: EdgePlanVersion | null } = await res.json();
      if (data?.active?.plan?.rules) {
        setCurrentPlan({ rules: data.active.plan.rules });
        setActiveVersionId(data.active.id ?? null);
        setPlanInsights(null);
        setProposedPlan(null);
        setDraftVersionId(null);
        await Promise.all([refreshVersions(), refreshTokens()]);
      }
    } catch (err) {
      console.error("promote failed", err);
    }
  };

  const simulatePlan = async () => {
    if (!proposedPlan) return;
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: {
            id: draftVersionId ?? crypto.randomUUID(),
            rules: proposedPlan.rules,
            createdAt: new Date().toISOString()
          },
          currentVersionId: activeVersionId
        })
      });
      if (res.ok) {
        const data: { summary?: string } = await res.json();
        if (typeof data.summary === "string") {
          const summaryText = data.summary;
          setPlanInsights((prev) => ({
            summary: summaryText,
            validation: prev?.validation ?? {
              valid: true,
              errors: [],
              warnings: []
            },
            risk: prev?.risk ?? null,
            riskAudit: prev?.riskAudit ?? null
          }));
        }
      }
    } catch (err) {
      console.error("simulate failed", err);
    }
  };

  const rollbackLatest = async () => {
    const candidates = availableVersions.filter(
      (v) => v.id !== activeVersionId
    );
    if (!candidates.length) return;
    try {
      const res = await fetch("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: candidates[0].id })
      });
      if (res.ok) {
        const data: { active?: EdgePlanVersion | null } = await res.json();
        if (data?.active?.plan?.rules) {
          setCurrentPlan({ rules: data.active.plan.rules });
          setActiveVersionId(data.active.id ?? null);
          setPlanInsights(null);
          setProposedPlan(null);
          setDraftVersionId(null);
          await Promise.all([refreshVersions(), refreshTokens()]);
        }
      }
    } catch (err) {
      console.error("rollback failed", err);
    }
  };

  const createPreviewToken = async () => {
    if (!activeVersionId || isCreatingToken) return;
    try {
      setIsCreatingToken(true);
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: activeVersionId,
          expiresInSeconds: 86400
        })
      });
      if (res.ok) {
        await refreshTokens();
      }
    } catch (err) {
      console.error("create token failed", err);
    } finally {
      setIsCreatingToken(false);
    }
  };

  const deletePreviewToken = async (token: string) => {
    try {
      const res = await fetch(`/api/token/${token}`, { method: "DELETE" });
      if (res.ok) {
        await refreshTokens();
      }
    } catch (err) {
      console.error("delete token failed", err);
    }
  };

  const exportRules = async () => {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: proposedPlan?.rules ?? currentPlan.rules,
          filename: "cdn-config.json"
        })
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cdn-config.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("export failed", e);
    }
  };

  const renderToolMessage = (
    toolMessage: Extract<ChatMessage, { role: "tool" }>
  ) => {
    const { summary, details } = toolMessage;
    if (!details) {
      return (
        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
          {summary}
        </div>
      );
    }

    const statusValue = details.status;
    const statusText =
      typeof statusValue === "string"
        ? formatKeyLabel(statusValue)
        : statusValue !== undefined
          ? summarizeValue(statusValue)
          : null;
    const statusLower =
      typeof statusValue === "string" ? statusValue.toLowerCase() : "";
    const statusTone =
      statusLower === "success" || statusLower === "completed"
        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
        : statusLower === "error" || statusLower === "failed"
          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
          : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200";
    const hasRawPayload =
      details.input !== undefined || details.output !== undefined;

    return (
      <div className="text-xs space-y-2 text-neutral-800 dark:text-neutral-100">
        <div className="font-medium">{summary}</div>
        {statusText ? (
          <div
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone}`}
          >
            Status: {statusText}
          </div>
        ) : null}
        {renderSummarySection("Input", details.input)}
        {renderSummarySection("Output", details.output)}
        {hasRawPayload ? (
          <details className="rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
            <summary className="cursor-pointer text-neutral-500 dark:text-neutral-400">
              View raw payload
            </summary>
            <div className="mt-2 space-y-2">
              {details.input !== undefined ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Input
                  </div>
                  <pre className="overflow-auto rounded bg-neutral-900/80 p-2 text-[11px] text-neutral-100 dark:bg-neutral-900">
                    {JSON.stringify(details.input, null, 2)}
                  </pre>
                </div>
              ) : null}
              {details.output !== undefined ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Output
                  </div>
                  <pre className="overflow-auto rounded bg-neutral-900/80 p-2 text-[11px] text-neutral-100 dark:bg-neutral-900">
                    {JSON.stringify(details.output, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    );
  };

  const revertChanges = () => {
    setProposedPlan(null);
    setPlanInsights(null);
    setDraftVersionId(null);
  };

  const currentRule = useMemo(() => {
    if (activeRuleIndex === null) return null;
    return currentPlan.rules[activeRuleIndex] ?? null;
  }, [activeRuleIndex, currentPlan.rules]);

  return (
    <>
      <div className="h-screen w-full flex bg-neutral-50 dark:bg-neutral-900">
        {/* Left Pane - Chat & Configuration */}
        <div className="flex-1 flex flex-col border-r border-neutral-200 dark:border-neutral-800">
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 bg-blue-600 rounded-lg">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="white"
                    role="img"
                    aria-labelledby="app-logo-title"
                  >
                    <title id="app-logo-title">Edge Composer Logo</title>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h1 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">
                    CDN Configurator
                  </h1>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    AI-powered CDN optimization
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsSettingsOpen(true)}
                  tooltip="Open settings"
                >
                  <Gear size={18} />
                </Button>
                <Button size="sm" onClick={toggleTheme}>
                  {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
              </div>
            </div>
          </div>
          <ChatView
            messages={messages}
            todos={todos}
            notes={notes}
            renderToolMessage={renderToolMessage}
          />

          {/* Chat Input */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Textarea
                    placeholder="Describe your CDN optimization needs... (e.g., 'Cache images for 24 hours and optimize for mobile')"
                    className="min-h-[80px] resize-none border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
                    value={input}
                    onChange={handleInputChange}
                    disabled={isGenerating}
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className={`px-6 ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={!input.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <Loader /> Generating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play size={18} /> Generate
                    </span>
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                <span>
                  Use natural language to describe your CDN configuration
                </span>
                <div className="flex items-center gap-2">
                  {proposedPlan ? (
                    <>
                      <Button
                        size="sm"
                        onClick={simulatePlan}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        disabled={isGenerating}
                      >
                        Simulate
                      </Button>
                      <Button
                        size="sm"
                        onClick={applyChanges}
                        className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        disabled={isGenerating || !draftVersionId}
                      >
                        <CheckCircle size={16} className="mr-1" />
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        onClick={exportRules}
                        className="text-neutral-600 border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/20"
                        disabled={isGenerating}
                      >
                        Export
                      </Button>
                      <Button
                        size="sm"
                        onClick={revertChanges}
                        className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        disabled={isGenerating}
                      >
                        <ArrowClockwise size={16} className="mr-1" />
                        Revert
                      </Button>
                      <Button
                        size="sm"
                        onClick={rollbackLatest}
                        className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={isGenerating || availableVersions.length < 2}
                      >
                        Rollback
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={exportRules}
                    className="text-neutral-600 border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/20"
                    disabled={isGenerating}
                  >
                    Export
                  </Button>
                  <Button
                    size="sm"
                    onClick={createPreviewToken}
                    className="text-neutral-600 border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/20"
                    disabled={
                      isGenerating || !activeVersionId || isCreatingToken
                    }
                  >
                    {isCreatingToken ? "Creating..." : "Preview Token"}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          <div className="px-6 py-4 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Preview Tokens
              </h4>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {previewTokens.length} active
              </span>
            </div>
            {previewTokens.length === 0 ? (
              <div className="mt-3 rounded border border-dashed border-neutral-200 bg-white p-3 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                Generate and promote a plan to mint preview tokens.
              </div>
            ) : (
              <div className="mt-3 space-y-2 max-h-56 overflow-auto pr-1">
                {previewTokens.map((token) => (
                  <div
                    key={token.token}
                    className="flex items-center justify-between rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-3 text-sm"
                  >
                    <div>
                      <div className="font-mono text-xs text-neutral-800 dark:text-neutral-100">
                        {token.token}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Version {token.versionId} · Created{" "}
                        {new Date(token.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            `${window.location.origin}/preview/${token.token}`
                          )
                        }
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deletePreviewToken(token.token)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Display */}
          <div className="flex-1 p-6 overflow-auto">
            {proposedPlan ? (
              <div className="space-y-4">
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">
                  Proposed Changes
                </h3>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                      Active Version
                    </div>
                    <div className="font-mono text-neutral-800 dark:text-neutral-200 text-xs">
                      {activeVersionId ?? "none"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                      Draft Version
                    </div>
                    <div className="font-mono text-neutral-800 dark:text-neutral-200 text-xs">
                      {draftVersionId ?? "none"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                      Versions Stored
                    </div>
                    <div className="text-neutral-800 dark:text-neutral-200">
                      {availableVersions.length}
                    </div>
                  </div>
                </div>

                {planInsights && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                      <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                        Summary
                      </div>
                      <p className="text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap">
                        {planInsights.summary &&
                        planInsights.summary.trim().length > 0
                          ? planInsights.summary
                          : "Plan generated. Review the proposed configuration below."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                      <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                        Validation
                      </div>
                      {validationErrors.length === 0 &&
                      validationWarnings.length === 0 ? (
                        <div className="text-neutral-700 dark:text-neutral-200">
                          No validation issues detected.
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {validationWarnings.map((warn) => (
                            <li
                              key={warn}
                              className="text-amber-600 dark:text-amber-300"
                            >
                              Warning: {warn}
                            </li>
                          ))}
                          {validationErrors.map((err) => (
                            <li
                              key={err}
                              className="text-red-600 dark:text-red-300"
                            >
                              Error: {err}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                      <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                        Risk
                      </div>
                      <div className={`text-lg font-semibold ${riskTone}`}>
                        {riskLevel ? riskLevel.toUpperCase() : "NOT SCORED"}
                      </div>
                      {typeof riskScore === "number" ? (
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          Score {riskScore}/100
                        </div>
                      ) : (
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          No risk score available.
                        </div>
                      )}
                      {riskReasons.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                          {riskReasons.map((reason) => (
                            <li key={reason}>- {reason}</li>
                          ))}
                        </ul>
                      )}
                      {riskAudit && (
                        <details className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                          <summary className="cursor-pointer text-neutral-500 dark:text-neutral-300">
                            View audit notes
                          </summary>
                          <div className="mt-2 whitespace-pre-wrap bg-neutral-100 dark:bg-neutral-900/60 p-2 rounded">
                            {riskAudit}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}

                {/* Diff Display */}
                <div className="space-y-3">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    Current Configuration
                  </div>
                  {currentPlan.rules.map((rule, index) => {
                    const rulePath = extractRulePath(rule);
                    const itemKey =
                      rule.id ??
                      `${rule.type}-${rulePath ?? rule.description ?? index}`;
                    return (
                      <div
                        key={itemKey}
                        className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded">
                            {rule.type}
                          </span>
                          {rulePath && (
                            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                              {rulePath}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-neutral-700 dark:text-neutral-300">
                          {rule.description}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600"></div>
                    <ArrowRight size={16} className="text-neutral-400" />
                    <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600"></div>
                  </div>

                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                    Proposed Configuration
                  </div>
                  {proposedPlan.rules.map((rule, index) => {
                    const rulePath = extractRulePath(rule);
                    const itemKey =
                      rule.id ??
                      `${rule.type}-${rulePath ?? rule.description ?? index}`;
                    return (
                      <div
                        key={itemKey}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-green-200 dark:bg-green-700 px-2 py-1 rounded">
                            {rule.type}
                          </span>
                          {rulePath && (
                            <span className="text-xs font-mono text-green-600 dark:text-green-400">
                              {rulePath}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          {rule.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4 max-w-md">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-blue-600 dark:text-blue-400"
                      role="img"
                      aria-labelledby="empty-state-icon-title"
                    >
                      <title id="empty-state-icon-title">
                        Edge Composer Placeholder Icon
                      </title>
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                    Ready to Optimize
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Describe your CDN optimization needs in natural language
                    above. The AI will generate a configuration plan with
                    performance improvements.
                  </p>
                  <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-1">
                    <div>
                      Try: "Cache images for 24 hours and add security headers"
                    </div>
                    <div>
                      Or: "Optimize for e-commerce with fast product loading"
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Current Rules */}
        <div className="w-96 bg-white dark:bg-neutral-950 flex flex-col border-l border-neutral-200 dark:border-neutral-800">
          <RuleDetailsPanel
            rule={currentRule ?? null}
            onSelectRule={setActiveRuleIndex}
            rules={currentPlan.rules}
            onResetRule={async (ruleIndex) => {
              const updated = await resetRule(ruleIndex);
              setCurrentPlan((_prev) => ({ rules: updated }));
            }}
            onUpdateRule={async (ruleIndex, patch) => {
              const updated = await updateRule(ruleIndex, patch);
              setCurrentPlan((_prev) => ({ rules: updated }));
            }}
            onRemoveRule={async (ruleIndex) => {
              const updated = await removeRule(ruleIndex);
              setCurrentPlan((_prev) => ({ rules: updated }));
            }}
          />
          <PlaybooksPanel
            state={playbookState}
            onRunPlaybook={async (playbookId) => {
              const result = await runPlaybook(playbookId);
              setPlaybookState(result);
            }}
            onAdvanceStep={async () => {
              const next = await advancePlaybookStep();
              setPlaybookState(next);
            }}
          />
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
            <div>Version: {previewMetrics.version}</div>
            <div>
              Route: {previewMetrics.route.toUpperCase()} - Cache:{" "}
              {previewMetrics.cacheStatus}
            </div>
            <div>
              Hits/Misses: {previewMetrics.hitCount}/{previewMetrics.missCount}{" "}
              - P95: {previewMetrics.p95Latency}ms
            </div>
          </div>
        </div>
      </div>
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        originInput={originInput}
        onOriginInputChange={handleOriginInputChange}
        onSubmit={handleOriginSubmit}
        onClear={handleOriginClear}
        originOverride={originOverride}
        isSaving={isSavingOrigin}
        isLoading={isLoadingOrigin}
        error={originError}
      />
    </>
  );
}
