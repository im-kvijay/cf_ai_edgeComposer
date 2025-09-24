import { useMemo, useState } from "react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import type { CDNRule } from "@/cdn-tools";
import type { ChecklistItem } from "@/shared-types";

interface RuleDetailsPanelProps {
  rules: CDNRule[];
  rule: CDNRule | null;
  onSelectRule: (index: number | null) => void;
  onResetRule: (ruleIndex: number) => Promise<void> | void;
  onUpdateRule: (ruleIndex: number, patch: Partial<CDNRule>) => Promise<void> | void;
  onRemoveRule: (ruleIndex: number) => Promise<void> | void;
  linkedChecklistItem?: ChecklistItem | null;
}

export function RuleDetailsPanel({
  rules,
  rule,
  onSelectRule,
  onResetRule,
  onUpdateRule,
  onRemoveRule,
  linkedChecklistItem
}: RuleDetailsPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const details = useMemo(() => {
    if (!rule) return null;
    return {
      title: `${rule.type.toUpperCase()} rule`,
      rows: Object.entries(rule)
        .filter(([key]) => key !== "type")
        .map(([key, value]) => ({
          label: key,
          value: Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : `${value}`
        }))
    };
  }, [rule]);

  const handleToggle = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
    onSelectRule(index);
  };

  return (
    <div className="flex-1 overflow-auto border-b border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Current Rules</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{rules.length} total rules</div>
        </div>
        {linkedChecklistItem ? (
          <div className="rounded bg-blue-500/10 px-3 py-1 text-xs text-blue-600 dark:text-blue-300">
            Linked checklist: {linkedChecklistItem.title}
          </div>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          No rules applied yet. Generate and apply a plan to populate this panel.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <Card
                key={`${item.type}-${index}`}
                className={`border transition ${
                  isExpanded
                    ? "border-blue-400 shadow-md dark:border-blue-700"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                  onClick={() => handleToggle(index)}
                >
                  <div>
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Rule #{index + 1}</div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">{item.type}</div>
                  </div>
                  <div className="text-xs text-neutral-400">{isExpanded ? "Hide" : "Show"}</div>
                </button>

                {isExpanded ? (
                  <div className="space-y-3 border-t border-neutral-200 px-3 py-3 text-sm dark:border-neutral-800">
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(item).map(([key, value]) => (
                        <div key={key} className="flex items-baseline justify-between gap-4">
                          <div className="text-xs uppercase tracking-wide text-neutral-400">{key}</div>
                          <div className="flex-1 text-right text-neutral-800 dark:text-neutral-200">
                            {Array.isArray(value)
                              ? value.length === 0
                                ? "—"
                                : value.join(", ")
                              : typeof value === "object" && value
                                ? JSON.stringify(value)
                                : value?.toString() ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-2 text-xs">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onResetRule(index)}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onUpdateRule(index, item)}
                      >
                        Quick Fix
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRemoveRule(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {details ? (
        <div className="mt-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Selected Rule</div>
          <div className="grid grid-cols-1 gap-2">
            {details.rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <div className="text-neutral-500 dark:text-neutral-400">{row.label}</div>
                <div className="text-right text-neutral-800 dark:text-neutral-100">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
