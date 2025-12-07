import type { Plan, PlanVersion, PreviewToken, PlanInsights, Rule, ToolTrace, TodoItem, ResearchNote, Playbook } from '../types';

// ============================================================================
// API CLIENT
// ============================================================================

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new APIError(
      error.message || `HTTP ${response.status}`,
      response.status,
      error.code
    );
  }

  return response.json();
}

// ============================================================================
// PLAN API
// ============================================================================

interface GenerateResponse {
  config: Rule[];
  insights: PlanInsights | null;
  draftVersionId: string | null;
  assistant: string;
  trace: ToolTrace[];
  todos: TodoItem[];
  notes: ResearchNote[];
  playbook: Playbook | null;
}

export async function generatePlan(prompt: string): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export async function getActivePlan(): Promise<{ active: PlanVersion | null }> {
  return request('/api/active');
}

export async function getDraftPlan(): Promise<{ draft: PlanVersion | null }> {
  return request('/api/draft');
}

export async function saveDraft(plan: Plan, description?: string): Promise<{ draft: PlanVersion }> {
  return request('/api/plan', {
    method: 'POST',
    body: JSON.stringify({ plan, description }),
  });
}

export async function promoteDraft(versionId?: string): Promise<{ active: PlanVersion }> {
  return request('/api/promote', {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}

export async function rollback(versionId: string): Promise<{ active: PlanVersion }> {
  return request('/api/rollback', {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}

// ============================================================================
// VERSIONS API
// ============================================================================

export async function getVersions(): Promise<{ versions: PlanVersion[] }> {
  return request('/api/versions');
}

export async function getVersion(versionId: string): Promise<{ version: PlanVersion }> {
  return request(`/api/versions/${versionId}`);
}

// ============================================================================
// TOKENS API
// ============================================================================

export async function getTokens(): Promise<{ tokens: PreviewToken[] }> {
  return request('/api/tokens');
}

export async function createToken(versionId: string, expiresInSeconds?: number): Promise<{ token: PreviewToken }> {
  return request('/api/token', {
    method: 'POST',
    body: JSON.stringify({ versionId, expiresInSeconds }),
  });
}

export async function deleteToken(token: string): Promise<{ deleted: boolean }> {
  return request(`/api/token/${token}`, { method: 'DELETE' });
}

// ============================================================================
// ORIGIN API
// ============================================================================

export async function getOrigin(): Promise<{ origin: string | null }> {
  return request('/api/origin');
}

export async function setOrigin(origin: string): Promise<{ origin: string }> {
  return request('/api/origin', {
    method: 'POST',
    body: JSON.stringify({ origin }),
  });
}

export async function clearOrigin(): Promise<{ origin: null }> {
  return request('/api/origin', { method: 'DELETE' });
}

// ============================================================================
// SIMULATE & EXPORT API
// ============================================================================

interface SimulateResponse {
  summary: string;
  diff: {
    added: Rule[];
    removed: Rule[];
    changed: { before: Rule; after: Rule }[];
  };
  metrics: {
    p50: number;
    p95: number;
    estimatedErrorRate: number;
  };
}

export async function simulatePlan(plan: Plan, currentVersionId?: string): Promise<SimulateResponse> {
  return request('/api/simulate', {
    method: 'POST',
    body: JSON.stringify({ plan, currentVersionId }),
  });
}

export async function exportPlan(rules: Rule[], filename = 'cdn-config.json'): Promise<Blob> {
  const response = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: rules, filename }),
  });
  return response.blob();
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const api = {
  generate: generatePlan,
  getActive: getActivePlan,
  getDraft: getDraftPlan,
  saveDraft,
  promote: promoteDraft,
  rollback,
  getVersions,
  getVersion,
  getTokens,
  createToken,
  deleteToken,
  getOrigin,
  setOrigin,
  clearOrigin,
  simulate: simulatePlan,
  export: exportPlan,
};

export default api;
