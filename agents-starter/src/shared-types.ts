// Re-export all types for backwards compatibility
export type {
  Rule as CDNRule,
  Plan as EdgePlan,
  PlanVersion as EdgePlanVersion,
  PreviewToken as PreviewTokenState,
  ToolTrace as ToolTraceEntry,
  TodoItem as TodoEntry,
  ResearchNote,
  RuleType,
  CacheRule,
  HeaderRule,
  RouteRule,
  AccessRule,
  PerformanceRule,
  ImageRule,
  RateLimitRule,
  BotProtectionRule,
  GeoRoutingRule,
  SecurityRule,
  CanaryRule,
  BannerRule,
  OriginShieldRule,
  TransformRule,
  ValidationResult,
  RiskAssessment,
  PlanInsights,
  ChatMessage,
  Playbook as PlaybookState,
  PlaybookStep,
  PlaybookScenario,
  Metrics,
} from './types';

// Re-export ChecklistItem types that server.ts may use
export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  toolTrace?: Array<{
    id: string;
    label: string;
    status: 'pending' | 'running' | 'success' | 'error';
    input?: unknown;
    output?: unknown;
  }>;
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
  runState: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  groups: ChecklistGroup[];
  lastUpdatedAt: string;
  summary?: string;
}
