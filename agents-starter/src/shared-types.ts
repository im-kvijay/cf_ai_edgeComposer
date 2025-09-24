export type RuleType = "cache" | "header" | "route" | "access" | "performance";

export interface CacheRule {
  id: string;
  type: "cache";
  path: string;
  ttl: number;
  description?: string;
}

export interface HeaderRule {
  id: string;
  type: "header";
  action: "add" | "remove" | "modify";
  name: string;
  value?: string;
  description?: string;
}

export interface RouteRule {
  id: string;
  type: "route";
  from: string;
  to: string;
  ruleType: "redirect" | "rewrite" | "proxy";
  description?: string;
}

export interface AccessRule {
  id: string;
  type: "access";
  allow: string[];
  deny: string[];
  description?: string;
}

export interface PerformanceRule {
  id: string;
  type: "performance";
  optimization: "compression" | "minification" | "image-optimization" | "lazy-loading";
  enabled: boolean;
  description?: string;
}

export type CDNRule = CacheRule | HeaderRule | RouteRule | AccessRule | PerformanceRule;

export interface ToolTraceEntry {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  summary?: string;
  input?: unknown;
  output?: unknown;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

export type ChecklistRunState = "idle" | "running" | "completed" | "error";

export type ChecklistItemStatus = "pending" | "running" | "completed" | "error";

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  status: ChecklistItemStatus;
  toolTrace?: ToolTraceEntry[];
  notes?: string[];
  groupId?: string;
  ruleId?: string;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  description?: string;
  items: ChecklistItem[];
}

export interface ChecklistState {
  runState: ChecklistRunState;
  progress: number;
  groups: ChecklistGroup[];
  lastUpdatedAt: string;
  summary?: string;
}

export type TodoStatus = "pending" | "done";

export interface TodoEntry {
  id: string;
  text: string;
  status: TodoStatus;
}

export interface ResearchNote {
  id: string;
  note: string;
}

export type PlaybookScenario = "ecommerce" | "blog" | "api" | "static" | "custom";

export type PlaybookStepStatus = "pending" | "running" | "completed" | "blocked" | "error";

export interface PlaybookStep {
  id: string;
  title: string;
  description?: string;
  status: PlaybookStepStatus;
  checklistItemId?: string;
  toolTrace?: ToolTraceEntry[];
}

export interface PlaybookState {
  id: string;
  title: string;
  scenario: PlaybookScenario;
  steps: PlaybookStep[];
  activeStepIndex: number;
  startedAt: string;
  completedAt?: string;
  summary?: string;
}
