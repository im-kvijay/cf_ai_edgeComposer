/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useMemo, useState } from "react";

// Component imports
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea/Textarea";
import { Loader } from "@/components/loader/Loader";
import { ChecklistPanel } from "@/components/checklist/ChecklistPanel";
import { RuleDetailsPanel } from "@/components/rules/RuleDetailsPanel";
import { PlaybooksPanel } from "@/components/playbooks/PlaybooksPanel";
import type {
  ChecklistState,
  PlaybookState,
  ChecklistItem,
  CDNRule,
  TodoEntry,
  ResearchNote,
  ChecklistRunState
} from "@/shared-types";

// Icon imports
import {
  Moon,
  Sun,
  Play,
  Eye,
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
  | { role: 'tool'; text: string };

interface PreviewMetrics {
  version: string;
  route: 'v1' | 'v2';
  cacheStatus: 'HIT' | 'MISS';
  hitCount: number;
  missCount: number;
  p95Latency: number;
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
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);
  const [checklistStatus, setChecklistStatus] = useState<ChecklistRunState>("idle");
  const [activeRuleIndex, setActiveRuleIndex] = useState<number | null>(null);
  const [playbookState, setPlaybookState] = useState<PlaybookState | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    try {
      setIsGenerating(true);
      // Add user chat
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
      // Assistant summary (if provided)
      if (data?.assistant) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.assistant }]);
      }
      // Tool call trace
      if (Array.isArray(data?.trace)) {
        const toolMsgs: ChatMessage[] = data.trace.map((t: any) => ({
          role: 'tool',
          text: `${t.name}(${JSON.stringify(t.input)}) -> ${JSON.stringify(t.output)}`
        }));
        if (toolMsgs.length) setMessages(prev => [...prev, ...toolMsgs]);
      }
      if (Array.isArray(data?.todos)) setTodos(data.todos);
      if (Array.isArray(data?.notes)) setNotes(data.notes);
      if (data?.checklist) setChecklist(data.checklist as ChecklistState);
      if (data?.playbook) setPlaybookState(data.playbook as PlaybookState);
    } catch (err) {
      console.error('Generate error', err);
      setMessages(prev => [...prev, { role: 'assistant', text: 'I hit an error generating the plan. Please try again.' }]);
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
                    // Simplify tool readout
                    <code className="text-xs">{m.text.replace(/\s+/g, ' ')}</code>
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
        <ChecklistPanel
          state={checklist}
          onToggleItem={async (itemId) => {
            setChecklist((prev) => updateChecklistState(prev, itemId));
            await persistChecklistToggle(itemId);
          }}
          onRefresh={async () => {
            const next = await fetchChecklist();
            setChecklist(next);
          }}
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

