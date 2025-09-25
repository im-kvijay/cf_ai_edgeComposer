export type RuleType =
  | "cache"
  | "header"
  | "route"
  | "access"
  | "performance"
  | "image"
  | "rate-limit"
  | "bot-protection"
  | "geo-routing"
  | "security"
  | "canary"
  | "banner"
  | "origin-shield"
  | "transform";

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

export interface ImageRule {
  id: string;
  type: "image";
  path: string;
  quality?: number; // 1-100
  format?: "auto" | "webp" | "avif" | "jpeg";
  width?: number;
  height?: number;
  description?: string;
}

export interface RateLimitRule {
  id: string;
  type: "rate-limit";
  path: string;
  requestsPerMinute: number;
  burst?: number;
  action: "block" | "challenge" | "delay" | "log";
  description?: string;
}

export interface BotProtectionRule {
  id: string;
  type: "bot-protection";
  mode: "off" | "js-challenge" | "managed-challenge" | "block";
  sensitivity?: "low" | "medium" | "high";
  description?: string;
}

export interface GeoRoutingRule {
  id: string;
  type: "geo-routing";
  from: string; // path
  toEU?: string;
  toUS?: string;
  toAPAC?: string;
  fallback?: string;
  description?: string;
}

export interface SecurityRule {
  id: string;
  type: "security";
  csp?: string; // content-security-policy
  hstsMaxAge?: number;
  xfo?: "DENY" | "SAMEORIGIN" | string; // X-Frame-Options
  referrerPolicy?: string;
  permissionsPolicy?: string;
  description?: string;
}

export interface CanaryRule {
  id: string;
  type: "canary";
  path: string;
  primaryOrigin: string;
  canaryOrigin: string;
  percentage: number; // 0-0.5 typical cap
  stickyBy?: "cookie" | "header" | "ip" | "session";
  metricGuardrail?: {
    metric: "latency" | "error_rate" | "cache_hit";
    operator: "lt" | "gt" | "lte" | "gte";
    threshold: number;
  };
  description?: string;
}

export interface BannerRule {
  id: string;
  type: "banner";
  path: string;
  message: string;
  style?: {
    tone?: "info" | "success" | "warning" | "danger" | "mint";
    theme?: "light" | "dark" | "auto";
  };
  schedule?: {
    start?: string; // ISO timestamp
    end?: string;   // ISO timestamp
    timezone?: string;
  };
  audience?: {
    segment?: "logged-in" | "guest" | "beta" | "maintenance";
    geo?: string[];
  };
  description?: string;
}

export interface OriginShieldRule {
  id: string;
  type: "origin-shield";
  origins: string[]; // ordered preference
  tieredCaching?: "smart" | "regional" | "off";
  healthcheck?: {
    path: string;
    intervalSeconds?: number;
    timeoutMs?: number;
  };
  description?: string;
}

export interface TransformRule {
  id: string;
  type: "transform";
  path: string;
  phase: "request" | "response";
  action:
    | {
        kind: "header";
        operation: "set" | "remove" | "append";
        header: string;
        value?: string;
      }
    | {
        kind: "html-inject";
        position: "head-start" | "head-end" | "body-start" | "body-end";
        markup: string;
      }
    | {
        kind: "rewrite-url";
        to: string;
      };
  description?: string;
}

export type CDNRule =
  | CacheRule
  | HeaderRule
  | RouteRule
  | AccessRule
  | PerformanceRule
  | ImageRule
  | RateLimitRule
  | BotProtectionRule
  | GeoRoutingRule
  | SecurityRule
  | CanaryRule
  | BannerRule
  | OriginShieldRule
  | TransformRule;

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
