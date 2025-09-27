import type {
  CDNRule,
  EdgePlanVersion,
  PlaybookState,
  PreviewTokenState,
  ResearchNote,
  TodoEntry,
  ToolTraceEntry
} from "@/shared-types";

export interface CDNPlan {
  rules: CDNRule[];
}

type BaseMessage = { id: string };

export type ChatMessage =
  | (BaseMessage & { role: "user"; text: string })
  | (BaseMessage & { role: "assistant"; text: string })
  | (BaseMessage & {
      role: "tool";
      summary: string;
      details?: {
        input?: unknown;
        output?: unknown;
        status?: string;
        startedAt?: string;
        finishedAt?: string;
      };
    });

export interface PreviewMetrics {
  version: string;
  route: "v1" | "v2";
  cacheStatus: "HIT" | "MISS";
  hitCount: number;
  missCount: number;
  p95Latency: number;
}

export interface PlanInsights {
  summary: string | null;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  risk: { score: number; classification: string; reasons: string[] } | null;
  riskAudit?: string | null;
}

export interface GenerateResponse {
  config?: Array<Partial<CDNRule>>;
  insights?: PlanInsights | null;
  draftVersionId?: string;
  assistant?: string;
  trace?: ToolTraceEntry[];
  todos?: TodoEntry[];
  notes?: ResearchNote[];
  playbook?: PlaybookState | null;
}

export interface PlanStateSummary {
  activeVersionId: string | null;
  draftVersionId: string | null;
  versions: EdgePlanVersion[];
  tokens: PreviewTokenState[];
}
