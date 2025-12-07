// ============================================================================
// RULE TYPES
// ============================================================================

export type RuleType =
  | 'cache'
  | 'header'
  | 'route'
  | 'access'
  | 'performance'
  | 'image'
  | 'rate-limit'
  | 'bot-protection'
  | 'geo-routing'
  | 'security'
  | 'canary'
  | 'banner'
  | 'origin-shield'
  | 'transform';

interface BaseRule {
  id: string;
  description?: string;
}

export interface CacheRule extends BaseRule {
  type: 'cache';
  path: string;
  ttl: number;
}

export interface HeaderRule extends BaseRule {
  type: 'header';
  action: 'add' | 'remove' | 'modify';
  name: string;
  value?: string;
}

export interface RouteRule extends BaseRule {
  type: 'route';
  from: string;
  to: string;
  ruleType: 'redirect' | 'rewrite' | 'proxy';
}

export interface AccessRule extends BaseRule {
  type: 'access';
  allow: string[];
  deny: string[];
}

export interface PerformanceRule extends BaseRule {
  type: 'performance';
  optimization: 'compression' | 'minification' | 'image-optimization' | 'lazy-loading';
  enabled: boolean;
}

export interface ImageRule extends BaseRule {
  type: 'image';
  path: string;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'jpeg';
  width?: number;
  height?: number;
}

export interface RateLimitRule extends BaseRule {
  type: 'rate-limit';
  path: string;
  requestsPerMinute: number;
  burst?: number;
  action: 'block' | 'challenge' | 'delay' | 'log';
}

export interface BotProtectionRule extends BaseRule {
  type: 'bot-protection';
  mode: 'off' | 'js-challenge' | 'managed-challenge' | 'block';
  sensitivity?: 'low' | 'medium' | 'high';
}

export interface GeoRoutingRule extends BaseRule {
  type: 'geo-routing';
  from: string;
  toEU?: string;
  toUS?: string;
  toAPAC?: string;
  fallback?: string;
}

export interface SecurityRule extends BaseRule {
  type: 'security';
  csp?: string;
  hstsMaxAge?: number;
  xfo?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

export interface CanaryRule extends BaseRule {
  type: 'canary';
  path: string;
  primaryOrigin: string;
  canaryOrigin: string;
  percentage: number;
  stickyBy?: 'cookie' | 'header' | 'ip' | 'session';
  metricGuardrail?: {
    metric: 'latency' | 'error_rate' | 'cache_hit';
    operator: 'lt' | 'gt' | 'lte' | 'gte';
    threshold: number;
  };
}

export interface BannerRule extends BaseRule {
  type: 'banner';
  path: string;
  message: string;
  style?: {
    tone?: 'info' | 'success' | 'warning' | 'danger' | 'mint';
    theme?: 'light' | 'dark' | 'auto';
  };
  schedule?: {
    start?: string;
    end?: string;
    timezone?: string;
  };
  audience?: {
    segment?: 'logged-in' | 'guest' | 'beta' | 'maintenance';
    geo?: string[];
  };
}

export interface OriginShieldRule extends BaseRule {
  type: 'origin-shield';
  origins: string[];
  tieredCaching?: 'smart' | 'regional' | 'off';
  healthcheck?: {
    path: string;
    intervalSeconds?: number;
    timeoutMs?: number;
  };
}

export interface TransformRule extends BaseRule {
  type: 'transform';
  path: string;
  phase: 'request' | 'response';
  action:
    | { kind: 'header'; operation: 'set' | 'remove' | 'append'; header: string; value?: string }
    | { kind: 'html-inject'; position: 'head-start' | 'head-end' | 'body-start' | 'body-end'; markup: string }
    | { kind: 'rewrite-url'; to: string };
}

export type Rule =
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

// ============================================================================
// PLAN & VERSION TYPES
// ============================================================================

export interface Plan {
  id: string;
  rules: Rule[];
  createdAt: string;
  summary?: string;
}

export interface PlanVersion {
  id: string;
  plan: Plan;
  promotedAt?: string;
  promotedBy?: string;
  description?: string;
}

export interface PreviewToken {
  token: string;
  versionId: string;
  createdAt: string;
  expiresAt?: string;
}

// ============================================================================
// INSIGHT TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RiskAssessment {
  score: number;
  classification: 'low' | 'moderate' | 'elevated' | 'high';
  reasons: string[];
}

export interface PlanInsights {
  summary: string | null;
  validation: ValidationResult;
  risk: RiskAssessment | null;
  riskAudit?: string | null;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export interface ToolTrace {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: unknown;
  output?: unknown;
  startedAt?: string;
  finishedAt?: string;
}

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
  timestamp: string;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: string;
}

export interface ToolMessage {
  id: string;
  role: 'tool';
  toolName: string;
  status: 'success' | 'error';
  input?: unknown;
  output?: unknown;
  timestamp: string;
}

export type ChatMessage = UserMessage | AssistantMessage | ToolMessage;

// ============================================================================
// TODO & NOTES
// ============================================================================

export interface TodoItem {
  id: string;
  text: string;
  status: 'pending' | 'done';
}

export interface ResearchNote {
  id: string;
  note: string;
}

// ============================================================================
// PLAYBOOK TYPES
// ============================================================================

export type PlaybookScenario = 'ecommerce' | 'blog' | 'api' | 'static' | 'custom';

export interface PlaybookStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'blocked' | 'error';
}

export interface Playbook {
  id: string;
  title: string;
  scenario: PlaybookScenario;
  steps: PlaybookStep[];
  activeStepIndex: number;
  startedAt: string;
  completedAt?: string;
}

// ============================================================================
// METRICS TYPES
// ============================================================================

export interface Metrics {
  version: string;
  cacheHitRate: number;
  p50Latency: number;
  p95Latency: number;
  requestCount: number;
  errorRate: number;
}

// ============================================================================
// APP STATE TYPES
// ============================================================================

export type ViewTab = 'rules' | 'versions' | 'tokens' | 'playbooks';

export interface AppState {
  // Plan state
  activePlan: PlanVersion | null;
  draftPlan: Plan | null;
  draftVersionId: string | null;

  // UI state
  activeTab: ViewTab;
  selectedRuleId: string | null;
  isGenerating: boolean;

  // Data
  versions: PlanVersion[];
  tokens: PreviewToken[];
  messages: ChatMessage[];
  todos: TodoItem[];
  notes: ResearchNote[];
  insights: PlanInsights | null;
  playbook: Playbook | null;
  metrics: Metrics;

  // Settings
  originUrl: string | null;
  theme: 'light' | 'dark';
}
