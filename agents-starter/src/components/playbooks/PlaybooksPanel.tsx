import { useMemo } from "react";
import { Button } from "@/components/button/Button";
import type { PlaybookState } from "@/shared-types";

interface PlaybooksPanelProps {
  state: PlaybookState | null;
  onRunPlaybook: (playbookId: string) => Promise<void> | void;
  onAdvanceStep: () => Promise<void> | void;
  isLoading?: boolean;
}

const PLAYBOOK_OPTIONS: Array<{ id: PlaybookState["scenario"]; label: string; description: string }> = [
  { id: "ecommerce", label: "E-commerce", description: "Optimize product detail pages and cart experiences." },
  { id: "blog", label: "Blog", description: "Improve caching and SEO for editorial sites." },
  { id: "api", label: "API", description: "Harden headers and reduce latency for API endpoints." },
  { id: "static", label: "Static", description: "Tune asset caching and edge rendering for static sites." }
];

export function PlaybooksPanel({ state, onRunPlaybook, onAdvanceStep, isLoading }: PlaybooksPanelProps) {
  const activeScenario = state?.scenario;
  const summary = useMemo(() => {
    if (!state) return "Select a playbook to begin";
    const total = state.steps.length;
    const completed = state.steps.filter((step) => step.status === "completed").length;
    return `${completed}/${total} steps complete`;
  }, [state]);

  return (
    <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium text-neutral-900 dark:text-neutral-100">Playbooks</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{summary}</div>
        </div>
        <Button size="sm" variant="outline" className="h-7" onClick={onAdvanceStep} disabled={isLoading || !state}>
          Advance Step
        </Button>
      </div>

      <div className="space-y-2">
        {PLAYBOOK_OPTIONS.map((option) => {
          const isActive = activeScenario === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`w-full rounded border px-3 py-2 text-left transition hover:border-neutral-400 dark:hover:border-neutral-600 ${
                isActive
                  ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                  : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300"
              }`}
              onClick={() => onRunPlaybook(option.id)}
              disabled={isLoading}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{option.description}</div>
            </button>
          );
        })}
      </div>

      {state ? (
        <div className="mt-3 space-y-2 rounded border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Current Step</div>
          {state.steps.length === 0 ? (
            <div className="text-neutral-500">No steps defined for this playbook.</div>
          ) : (
            state.steps.map((step, index) => (
              <div
                key={step.id}
                className={`rounded border px-2 py-2 transition ${
                  step.status === "completed"
                    ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200"
                    : step.status === "running"
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200"
                      : step.status === "error"
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200"
                        : step.status === "blocked"
                          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                          : "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{index + 1}. {step.title}</div>
                  <div className="text-[10px] uppercase tracking-wide">{step.status}</div>
                </div>
                {step.description ? (
                  <div className="mt-1 text-xs opacity-80">{step.description}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
