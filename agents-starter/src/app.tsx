/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useMemo, useState } from "react";

// Component imports
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea/Textarea";
import { Loader } from "@/components/loader/Loader";
import { RuleDetailsPanel } from "@/components/rules/RuleDetailsPanel";
import { PlaybooksPanel } from "@/components/playbooks/PlaybooksPanel";
import type {
  PlaybookState,
  CDNRule,
  TodoEntry,
  ResearchNote
} from "@/shared-types";

// Icon imports
import {
  Moon,
  Sun,
  Play,
  CheckCircle,
  ArrowRight,
  ArrowClockwise
} from "@phosphor-icons/react";

// Types for our CDN configuration
interface CDNPlan {
  rules: Array<{
    type: string;
    path?: string;
    ttl?: number;
    action?: string;
    name?: string;
    value?: string;
    description?: string;
  }>;
}

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; summary: string; details?: { input?: unknown; output?: unknown; status?: string; startedAt?: string; finishedAt?: string } };

interface PreviewMetrics {
  version: string;
  route: 'v1' | 'v2';
  cacheStatus: 'HIT' | 'MISS';
  hitCount: number;
  missCount: number;
  p95Latency: number;
}

interface PlanInsights {
  summary: string | null;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  risk: { score: number; classification: string; reasons: string[] } | null;
  riskAudit?: string | null;
}

const MAX_SUMMARY_ITEMS = 6;

function formatKeyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeValue(value: unknown, depth = 0): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed || "—";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (depth >= 1) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
    const preview = value
      .slice(0, 3)
      .map((item) => summarizeValue(item, depth + 1))
      .join(", ");
    return `[${preview}${value.length > 3 ? ", …" : ""}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    if (depth >= 1) {
      return `{ ${entries.length} field${entries.length === 1 ? "" : "s"} }`;
    }
    const preview = entries
      .slice(0, 3)
      .map(([key, val]) => `${formatKeyLabel(key)}: ${summarizeValue(val, depth + 1)}`)
      .join(", ");
    return `{ ${preview}${entries.length > 3 ? ", …" : ""} }`;
  }
  return String(value);
}

function renderSummarySection(label: string, data: unknown): JSX.Element | null {
  if (data === undefined || data === null) return null;

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return null;
    return (
      <div className="rounded bg-neutral-100 dark:bg-neutral-900/50 p-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {label}
        </div>
        <ul className="mt-1 space-y-1">
          {entries.slice(0, MAX_SUMMARY_ITEMS).map(([key, value], index) => (
            <li
              key={`${key}-${index}`}
              className="text-neutral-700 dark:text-neutral-200"
            >
              <span className="font-medium">{formatKeyLabel(key)}:</span> {summarizeValue(value)}
            </li>
          ))}
          {entries.length > MAX_SUMMARY_ITEMS ? (
            <li className="text-neutral-500 dark:text-neutral-400">…</li>
          ) : null}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded bg-neutral-100 dark:bg-neutral-900/50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-neutral-700 dark:text-neutral-200">
        {summarizeValue(data)}
      </div>
    </div>
  );
}

export default function CDNConfigurator() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as "dark" | "light") || "dark";
  });

  const [currentPlan, setCurrentPlan] = useState<CDNPlan>({
    rules: [
      {
        type: "cache",
        path: "/img/*",
        ttl: 86400,
        description: "Cache images for 24 hours"
      }
    ]
  });
  const [proposedPlan, setProposedPlan] = useState<CDNPlan | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<PreviewMetrics>({
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
  const [playbookState, setPlaybookState] = useState<PlaybookState | null>(null);
  const [planInsights, setPlanInsights] = useState<PlanInsights | null>(null);

  const riskLevel = planInsights?.risk?.classification;
  const riskScore = planInsights?.risk?.score;
  const riskReasons = planInsights?.risk?.reasons ?? [];
  const riskAudit = planInsights?.riskAudit ?? null;
  const riskTone = (() => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 dark:text-red-300';
      case 'elevated':
        return 'text-orange-600 dark:text-orange-300';
      case 'moderate':
        return 'text-amber-600 dark:text-amber-300';
      case 'low':
        return 'text-green-600 dark:text-green-300';
      default:
        return 'text-neutral-600 dark:text-neutral-300';
    }
  })();
  const validationWarnings = planInsights?.validation?.warnings ?? [];
  const validationErrors = planInsights?.validation?.errors ?? [];

  // --- Playbooks and rule helpers ---
  function makeId() {
    try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); }
  }

  function presetRulesForScenario(scenario: PlaybookState["scenario"]): CDNPlan["rules"] {
    switch (scenario) {
      case "ecommerce":
        return [
          { id: makeId(), type: "cache", path: "/images/*", ttl: 86400, description: "Cache product images for 24h" } as any,
          { id: makeId(), type: "performance", optimization: "compression", enabled: true, description: "Enable gzip/brotli" } as any,
          { id: makeId(), type: "header", action: "add", name: "Cache-Control", value: "public, max-age=86400", description: "Cache header for static assets" } as any,
          { id: makeId(), type: "canary", path: "/checkout/*", primaryOrigin: "primary", canaryOrigin: "checkout-v2", percentage: 0.1, stickyBy: "cookie", metricGuardrail: { metric: "latency", operator: "lt", threshold: 350 }, description: "Canary checkout edge" } as any,
          { id: makeId(), type: "banner", path: "/", message: "💚 Spring sale ships in 2 days", style: { tone: "mint", theme: "auto" }, schedule: { start: new Date().toISOString(), end: new Date(Date.now() + 86400000).toISOString() }, audience: { segment: "guest" }, description: "Campaign banner" } as any
        ];
      case "blog":
        return [
          { id: makeId(), type: "cache", path: "/assets/*", ttl: 604800, description: "Cache static assets for 7d" } as any,
          { id: makeId(), type: "header", action: "add", name: "Cache-Control", value: "public, max-age=604800", description: "Long cache for assets" } as any,
          { id: makeId(), type: "performance", optimization: "minification", enabled: true, description: "Minify HTML/CSS/JS" } as any,
          { id: makeId(), type: "banner", path: "/blog/*", message: "Scheduled maintenance Sunday 01:00 UTC", style: { tone: "warning", theme: "dark" }, schedule: { start: new Date().toISOString(), end: new Date(Date.now() + 48 * 3600 * 1000).toISOString() }, audience: { segment: "beta" }, description: "Maintenance notice" } as any
        ];
      case "api":
        return [
          { id: makeId(), type: "header", action: "add", name: "Cache-Control", value: "no-store", description: "Do not cache API responses" } as any,
          { id: makeId(), type: "performance", optimization: "compression", enabled: true, description: "Compress API responses" } as any,
          { id: makeId(), type: "rate-limit", path: "/api/*", requestsPerMinute: 600, action: "challenge", description: "Basic rate limit" } as any,
          { id: makeId(), type: "origin-shield", origins: ["primary", "backup"], tieredCaching: "regional", healthcheck: { path: "/health", intervalSeconds: 60, timeoutMs: 2000 }, description: "Shield API origins" } as any,
          { id: makeId(), type: "canary", path: "/api/*", primaryOrigin: "api-v1", canaryOrigin: "api-v2", percentage: 0.05, stickyBy: "header", metricGuardrail: { metric: "error_rate", operator: "lt", threshold: 0.03 }, description: "Edge API canary" } as any
        ];
      case "static":
        return [
          { id: makeId(), type: "cache", path: "/assets/*", ttl: 31536000, description: "Cache static assets for 1y" } as any,
          { id: makeId(), type: "header", action: "add", name: "Cache-Control", value: "public, max-age=31536000, immutable", description: "Immutable cache for hashed assets" } as any,
          { id: makeId(), type: "route", from: "/app/*", to: "/app/index.html", ruleType: "rewrite", description: "SPA fallback" } as any,
          { id: makeId(), type: "transform", path: "/", phase: "response", action: { kind: "html-inject", position: "head-end", markup: "<meta name=\"edge-composer\" content=\"static-theme\" />" }, description: "Inject preview meta" } as any
        ];
      default:
        return [];
    }
  }

  async function runPlaybook(playbookId: string) {
    const scenario = (playbookId as PlaybookState["scenario"]) || "custom";
    const rules = presetRulesForScenario(scenario);
    setProposedPlan({ rules });
    setPlanInsights(null);
    const steps = [
      { id: makeId(), title: "Generate preset rules", status: "completed" },
      { id: makeId(), title: "Review proposed configuration", status: "pending" },
      { id: makeId(), title: "Apply changes", status: "pending" }
    ] as any;
    const pb: PlaybookState = {
      id: makeId(),
      title: `${scenario} preset`,
      scenario: scenario as any,
      steps: steps as any,
      activeStepIndex: 1,
      startedAt: new Date().toISOString()
    } as PlaybookState;
    setPlaybookState(pb);
    return pb;
  }

  async function advancePlaybookStep() {
    if (!playbookState) return null as any;
    const idx = playbookState.activeStepIndex;
    const steps = playbookState.steps.map((s, i) => ({ ...s, status: i < idx ? "completed" : i === idx ? "completed" : s.status }));
    const nextIndex = Math.min(idx + 1, steps.length);
    const updated: PlaybookState = {
      ...playbookState,
      steps: steps as any,
      activeStepIndex: nextIndex,
      completedAt: nextIndex >= steps.length ? new Date().toISOString() : undefined
    };
    setPlaybookState(updated);
    return updated;
  }

  // Rule mutate helpers used by RuleDetailsPanel
  async function resetRule(ruleIndex: number) {
    const copy = [...currentPlan.rules];
    if (!copy[ruleIndex]) return copy;
    // Simple reset: remove description field
    const r: any = { ...copy[ruleIndex] };
    delete r.description;
    copy[ruleIndex] = r;
    return copy;
  }

  async function updateRule(ruleIndex: number, patch: Partial<CDNRule>) {
    const copy: any[] = [...currentPlan.rules];
    copy[ruleIndex] = { ...(copy[ruleIndex] as any), ...(patch as any) };
    return copy as CDNPlan["rules"];
  }

  async function removeRule(ruleIndex: number) {
    const copy = [...currentPlan.rules];
    copy.splice(ruleIndex, 1);
    return copy;
  }

  // Hydrate current rules from backend (if persisted)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/current');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.config)) {
            setCurrentPlan({ rules: data.config });
          }
        }
      } catch {}
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
  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  // Handle the main chat form submission: send the prompt to the backend and stream back plan updates.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      // Record the raw user prompt in the transcript before calling the backend.
      setMessages(prev => [...prev, { role: 'user', text: input }]);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input })
      });
      if (!res.ok) {
        console.error('Generate failed', res.status);
        setMessages(prev => [...prev, { role: 'assistant', text: `There was an error generating a plan (HTTP ${res.status}). Please try a more specific request.` }]);
        return;
      }
      const data = await res.json();
      const rules = Array.isArray(data?.config) ? enrichRulesWithIds(data.config) : [];
      setProposedPlan({ rules });
      if (data?.insights) {
        setPlanInsights(data.insights as PlanInsights);
      } else {
        setPlanInsights(null);
      }
      // Assistant summary (if provided)
      if (data?.assistant) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.assistant }]);
      }
      // Tool call trace (friendly summary + collapsible details)
      if (Array.isArray(data?.trace)) {
        const toolMsgs: ChatMessage[] = data.trace.map((t: any) => {
          const title = (t?.label || t?.name || 'tool') as string;
          const ok = (t?.status || 'success') === 'success';
          const summary = `${ok ? '✓' : '✕'} ${title}`;
          return {
            role: 'tool',
            summary,
            details: {
              status: t?.status,
              input: t?.input,
              output: t?.output,
              startedAt: t?.startedAt,
              finishedAt: t?.finishedAt
            }
          } as ChatMessage;
        });
        if (toolMsgs.length) setMessages(prev => [...prev, ...toolMsgs]);
      }
      if (Array.isArray(data?.todos)) setTodos(data.todos);
      if (Array.isArray(data?.notes)) setNotes(data.notes);
      if (data?.playbook) setPlaybookState(data.playbook as PlaybookState);
    } catch (err) {
      console.error('Generate error', err);
      setMessages(prev => [...prev, { role: 'assistant', text: 'I hit an error generating the plan. Please try again.' }]);
      setPlanInsights(null);
    } finally {
      setInput("");
      setIsGenerating(false);
    }
  };

  const mergeRules = (a: CDNPlan["rules"], b: CDNPlan["rules"]) => {
    const seen = new Set<string>();
    const serialize = (r: any) => JSON.stringify(r);
    const out: any[] = [];
    for (const r of [...a, ...b]) {
      const key = serialize(r);
      if (!seen.has(key)) { seen.add(key); out.push(r); }
    }
    return out as CDNPlan["rules"];
  };

  const enrichRulesWithIds = (rules: CDNPlan["rules"]) => {
    return rules.map((rule) => {
      if ((rule as any)?.id) return rule;
      return { ...rule };
    }) as CDNPlan["rules"];
  };

  const applyChanges = async () => {
    if (!proposedPlan) return;
    const merged = mergeRules(currentPlan.rules, proposedPlan.rules);
    setCurrentPlan({ rules: merged });
    setProposedPlan(null);
    setPlanInsights(null);
    // Persist to backend (KV if bound; memory otherwise)
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: merged })
      });
    } catch {}
  };

  const exportRules = async () => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: proposedPlan?.rules ?? currentPlan.rules, filename: 'cdn-config.json' })
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cdn-config.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('export failed', e);
    }
  };

  const renderToolMessage = (toolMessage: Extract<ChatMessage, { role: 'tool' }>) => {
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
      typeof statusValue === 'string'
        ? formatKeyLabel(statusValue)
        : statusValue !== undefined
          ? summarizeValue(statusValue)
          : null;
    const statusLower = typeof statusValue === 'string' ? statusValue.toLowerCase() : '';
    const statusTone =
      statusLower === 'success' || statusLower === 'completed'
        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
        : statusLower === 'error' || statusLower === 'failed'
          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
          : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
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
        {renderSummarySection('Input', details.input)}
        {renderSummarySection('Output', details.output)}
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
                  <pre className="overflow-auto rounded bg-neutral-900/80 p-2 text-[11px] text-neutral-100 dark:bg-neutral-900">{JSON.stringify(details.input, null, 2)}</pre>
                </div>
              ) : null}
              {details.output !== undefined ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Output
                  </div>
                  <pre className="overflow-auto rounded bg-neutral-900/80 p-2 text-[11px] text-neutral-100 dark:bg-neutral-900">{JSON.stringify(details.output, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    );
  };

  const ChatView = () => (
    <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Conversation</div>
      <div className="space-y-2 max-h-56 overflow-auto text-sm">
        {messages.length === 0 ? (
          <div className="text-neutral-500">No messages yet.</div>
        ) : (
          messages.map((m, i) => {
            const label = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'Tool';
            return (
              <div key={i} className={`rounded p-2 ${m.role === 'user' ? 'bg-blue-50 dark:bg-blue-900/20' : m.role === 'tool' ? 'bg-neutral-100 dark:bg-neutral-900/60' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
                <div className="whitespace-pre-wrap break-words text-neutral-800 dark:text-neutral-200">
                  {m.role === 'tool' ? (
                    renderToolMessage(m)
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {(todos.length > 0 || notes.length > 0) && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {todos.length > 0 && (
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Todo</div>
              <ul className="space-y-1 text-sm">
                {todos.map(t => (
                  <li key={t.id} className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-900/60 p-2 rounded">
                    <span className={`mr-2 ${t.status === 'done' ? 'line-through opacity-70' : ''}`}>{t.text}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${t.status === 'done' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>{t.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notes.length > 0 && (
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Research</div>
              <ul className="space-y-1 text-sm">
                {notes.map(n => (
                  <li key={n.id} className="bg-neutral-100 dark:bg-neutral-900/60 p-2 rounded">
                    {n.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const revertChanges = () => {
    setProposedPlan(null);
    setPlanInsights(null);
  };

  const currentRule = useMemo(() => {
    if (activeRuleIndex === null) return null;
    return currentPlan.rules[activeRuleIndex] ?? null;
  }, [activeRuleIndex, currentPlan.rules]);

  return (
    <div className="h-screen w-full flex bg-neutral-50 dark:bg-neutral-900">
      {/* Left Pane - Chat & Configuration */}
      <div className="flex-1 flex flex-col border-r border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 bg-blue-600 rounded-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
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
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            </div>
          </div>
        </div>
        <ChatView />

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
                className={`px-6 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!input.trim() || isGenerating}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2"><Loader /> Generating…</span>
                ) : (
                  <span className="flex items-center gap-2"><Play size={18} /> Generate</span>
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
              <span>Use natural language to describe your CDN configuration</span>
              <div className="flex items-center gap-2">
                {proposedPlan && (
                  <>
                    <Button
                      size="sm"
                      onClick={applyChanges}
                      className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      disabled={isGenerating}
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
                  </>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Configuration Display */}
        <div className="flex-1 p-6 overflow-auto">
          {proposedPlan ? (
            <div className="space-y-4">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-4">
                Proposed Changes
              </h3>

              {planInsights && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                      Summary
                    </div>
                    <p className="text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap">
                      {planInsights.summary && planInsights.summary.trim().length > 0
                        ? planInsights.summary
                        : 'Plan generated. Review the proposed configuration below.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                      Validation
                    </div>
                    {validationErrors.length === 0 && validationWarnings.length === 0 ? (
                      <div className="text-neutral-700 dark:text-neutral-200">No validation issues detected.</div>
                    ) : (
                      <ul className="space-y-1">
                        {validationWarnings.map((warn, idx) => (
                          <li key={`warn-${idx}`} className="text-amber-600 dark:text-amber-300">
                            ⚠️ {warn}
                          </li>
                        ))}
                        {validationErrors.map((err, idx) => (
                          <li key={`err-${idx}`} className="text-red-600 dark:text-red-300">
                            ⛔ {err}
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
                      {riskLevel ? riskLevel.toUpperCase() : 'NOT SCORED'}
                    </div>
                  {typeof riskScore === 'number' ? (
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
                      {riskReasons.map((reason, idx) => (
                        <li key={`risk-${idx}`}>• {reason}</li>
                      ))}
                    </ul>
                  )}
                  {riskAudit && (
                    <details className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <summary className="cursor-pointer text-neutral-500 dark:text-neutral-300">View audit notes</summary>
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
                {currentPlan.rules.map((rule, index) => (
                  <div key={index} className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded">
                        {rule.type}
                      </span>
                      {rule.path && (
                        <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                          {rule.path}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-neutral-700 dark:text-neutral-300">
                      {rule.description}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600"></div>
                  <ArrowRight size={16} className="text-neutral-400" />
                  <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-600"></div>
                </div>

                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Proposed Configuration
                </div>
                {proposedPlan.rules.map((rule, index) => (
                  <div key={index} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-green-200 dark:bg-green-700 px-2 py-1 rounded">
                        {rule.type}
                      </span>
                      {rule.path && (
                        <span className="text-xs font-mono text-green-600 dark:text-green-400">
                          {rule.path}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      {rule.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600 dark:text-blue-400">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                  Ready to Optimize
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Describe your CDN optimization needs in natural language above.
                  The AI will generate a configuration plan with performance improvements.
                </p>
                <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-1">
                  <div>Try: "Cache images for 24 hours and add security headers"</div>
                  <div>Or: "Optimize for e-commerce with fast product loading"</div>
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
            setCurrentPlan((prev) => ({ rules: updated }));
          }}
          onUpdateRule={async (ruleIndex, patch) => {
            const updated = await updateRule(ruleIndex, patch);
            setCurrentPlan((prev) => ({ rules: updated }));
          }}
          onRemoveRule={async (ruleIndex) => {
            const updated = await removeRule(ruleIndex);
            setCurrentPlan((prev) => ({ rules: updated }));
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
          <div>Route: {previewMetrics.route.toUpperCase()} • Cache: {previewMetrics.cacheStatus}</div>
          <div>Hits/Misses: {previewMetrics.hitCount}/{previewMetrics.missCount} • P95: {previewMetrics.p95Latency}ms</div>
        </div>
      </div>
    </div>
  );
}
