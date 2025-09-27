import type { JSX } from "react";
import type { CDNRule } from "@/shared-types";

export const MAX_SUMMARY_ITEMS = 6;

export function formatKeyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function summarizeValue(value: unknown, depth = 0): string {
  if (value === undefined || value === null) return "--";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed || "--";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (depth >= 1)
      return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
    const preview = value
      .slice(0, 3)
      .map((item) => summarizeValue(item, depth + 1))
      .join(", ");
    return `[${preview}${value.length > 3 ? ", ..." : ""}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    if (depth >= 1) {
      return `{ ${entries.length} field${entries.length === 1 ? "" : "s"} }`;
    }
    const preview = entries
      .slice(0, 3)
      .map(
        ([key, val]) =>
          `${formatKeyLabel(key)}: ${summarizeValue(val, depth + 1)}`
      )
      .join(", ");
    return `{ ${preview}${entries.length > 3 ? ", ..." : ""} }`;
  }
  return String(value);
}

export function extractRulePath(rule: CDNRule): string | undefined {
  if ("path" in rule && typeof rule.path === "string") return rule.path;
  if ("from" in rule && typeof rule.from === "string") return rule.from;
  if ("pattern" in rule && typeof rule.pattern === "string")
    return rule.pattern;
  if ("route" in rule && typeof rule.route === "string") return rule.route;
  if ("target" in rule && typeof rule.target === "string") return rule.target;
  return undefined;
}

export function renderSummarySection(
  label: string,
  data: unknown
): JSX.Element | null {
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
          {entries.slice(0, MAX_SUMMARY_ITEMS).map(([entryKey, entryValue]) => {
            const displayValue = summarizeValue(entryValue);
            return (
              <li
                key={`${entryKey}-${displayValue}`}
                className="text-neutral-700 dark:text-neutral-200"
              >
                <span className="font-medium">{formatKeyLabel(entryKey)}:</span>{" "}
                {displayValue}
              </li>
            );
          })}
          {entries.length > MAX_SUMMARY_ITEMS ? (
            <li className="text-neutral-500 dark:text-neutral-400">...</li>
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
