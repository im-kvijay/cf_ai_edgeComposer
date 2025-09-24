import { useMemo } from "react";
import { Button } from "@/components/button/Button";
import { Loader } from "@/components/loader/Loader";
import type { ChecklistItem, ChecklistState, ChecklistToolTraceEntry } from "@/shared-types";

interface ChecklistPanelProps {
  state: ChecklistState | null;
  onToggleItem: (itemId: string) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  isLoading?: boolean;
  onSelectItem?: (item: ChecklistItem | null) => void;
  onToggleTrace?: (itemId: string, traceId: string) => void;
}

export function ChecklistPanel({ state, onToggleItem, onRefresh, isLoading, onSelectItem, onToggleTrace }: ChecklistPanelProps) {
  const renderStatusClass = (trace: ChecklistToolTraceEntry) => {
    switch (trace.status) {
      case "success":
        return "bg-green-500/20 text-green-600 dark:text-green-300";
      case "error":
        return "bg-red-500/20 text-red-600 dark:text-red-300";
      case "running":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-300";
      default:
        return "bg-neutral-500/20 text-neutral-600 dark:text-neutral-300";
    }
  };
  const totalItems = useMemo(() => {
    if (!state) return 0;
    return state.groups.reduce((count, group) => count + group.items.length, 0);
  }, [state]);

  const completedItems = useMemo(() => {
    if (!state) return 0;
    return state.groups.reduce(
      (count, group) => count + group.items.filter((item) => item.status === "completed").length,
      0
    );
  }, [state]);

  const progress = useMemo(() => {
    if (!state || totalItems === 0) return 0;
    return Math.round((completedItems / totalItems) * 100);
  }, [completedItems, state, totalItems]);

  const handleToggle = async (item: ChecklistItem) => {
    if (!item || isLoading) return;
    onSelectItem?.(item);
    await onToggleItem(item.id);
  };

  return (
    <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-medium text-neutral-900 dark:text-neutral-100">Checklist</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {state ? `${completedItems}/${totalItems} complete • ${state.runState}` : "No checklist loaded"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative h-2 w-28 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="absolute inset-y-0 left-0 bg-green-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7"
          >
            {isLoading ? <Loader /> : "Refresh"}
          </Button>
        </div>
      </div>

      {!state ? (
        <div className="rounded border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Checklist state will appear after generating a plan.
        </div>
      ) : (
        <div className="space-y-3">
          {state.groups.map((group) => (
            <div key={group.id} className="rounded border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{group.title}</div>
                  {group.description ? (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{group.description}</div>
                  ) : null}
                </div>
                <div className="text-xs text-neutral-400">
                  {group.items.filter((item) => item.status === "completed").length}/{group.items.length}
                </div>
              </div>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggle(item)}
                    className={`flex w-full items-start justify-between rounded border px-3 py-2 text-left text-sm transition hover:border-neutral-400 dark:hover:border-neutral-600 ${
                      item.status === "completed"
                        ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
                        : item.status === "running"
                          ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
                          : "border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200"
                    }`}
                    disabled={isLoading}
                  >
                    <div>
                      <div className="font-medium">{item.title}</div>
                      {item.description ? (
                        <div className="mt-1 text-xs opacity-80">{item.description}</div>
                      ) : null}
                      {item.toolTrace && item.toolTrace.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {item.toolTrace.map((trace) => (
                            <button
                              key={trace.id}
                              type="button"
                              className="flex w-full items-center justify-between rounded border border-transparent px-2 py-1 text-xs transition hover:border-neutral-300 dark:hover:border-neutral-700"
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleTrace?.(item.id, trace.id);
                              }}
                            >
                              <span className="truncate text-neutral-500 dark:text-neutral-400">{trace.label}</span>
                              <span
                                className={`ml-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${renderStatusClass(trace)}`}
                              >
                                {trace.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-4 mt-1 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {item.status}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
