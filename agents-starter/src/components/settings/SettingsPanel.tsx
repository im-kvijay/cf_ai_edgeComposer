import { useId } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/button/Button";

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  originInput: string;
  onOriginInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onClear: () => Promise<void>;
  originOverride: string | null;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

export function SettingsPanel({
  isOpen,
  onClose,
  originInput,
  onOriginInputChange,
  onSubmit,
  onClear,
  originOverride,
  isSaving,
  isLoading,
  error
}: SettingsPanelProps) {
  const originInputId = useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-neutral-900/30 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Settings
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Configure preview behaviour and local overrides.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-6 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Preview Origin
            </h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Point preview traffic at a safe backend while you iterate. Leave
              blank to serve the placeholder template.
            </p>

            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
              {isLoading ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Loading current origin...
                </p>
              ) : (
                <form onSubmit={onSubmit} className="space-y-3">
                  <label
                    htmlFor={originInputId}
                    className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
                  >
                    Origin URL
                  </label>
                  <input
                    id={originInputId}
                    type="url"
                    value={originInput}
                    onChange={onOriginInputChange}
                    placeholder="https://example.com"
                    className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  />
                  {originOverride ? (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Currently targeting {originOverride}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      No upstream configured. The preview will return the
                      built-in sample response.
                    </p>
                  )}
                  {error ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSaving}
                      onClick={() => {
                        void onClear();
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
