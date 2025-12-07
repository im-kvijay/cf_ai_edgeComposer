import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { Plan, PlanVersion, Rule, PlanInsights, TodoItem, ResearchNote, Playbook, ToolTrace } from '../types';
import { generateId } from '../utils/formatters';

import type { PlaybookScenario, PlaybookStep } from '../types';

interface UsePlanReturn {
  // State
  activePlan: PlanVersion | null;
  draftPlan: Plan | null;
  draftVersionId: string | null;
  insights: PlanInsights | null;
  todos: TodoItem[];
  notes: ResearchNote[];
  playbook: Playbook | null;
  toolTrace: ToolTrace[];

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;
  isPromoting: boolean;

  // Actions
  generate: (prompt: string) => Promise<void>;
  promote: () => Promise<void>;
  rollback: (versionId: string) => Promise<void>;
  simulate: () => Promise<void>;
  discardDraft: () => void;
  updateRule: (ruleId: string, updates: Partial<Rule>) => void;
  removeRule: (ruleId: string) => void;
  addRule: (rule: Rule) => void;
  reorderRules: (fromIndex: number, toIndex: number) => void;

  // Playbook actions
  startPlaybook: (scenario: PlaybookScenario, steps: PlaybookStep[], rules: Rule[]) => Promise<void>;
  advancePlaybookStep: () => void;
  cancelPlaybook: () => void;

  // Refresh
  refresh: () => Promise<void>;
}

export function usePlan(): UsePlanReturn {
  const [activePlan, setActivePlan] = useState<PlanVersion | null>(null);
  const [draftPlan, setDraftPlan] = useState<Plan | null>(null);
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);
  const [insights, setInsights] = useState<PlanInsights | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [toolTrace, setToolTrace] = useState<ToolTrace[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [activeRes, draftRes] = await Promise.all([
        api.getActive(),
        api.getDraft(),
      ]);

      if (activeRes.active) {
        setActivePlan(activeRes.active);
      }

      if (draftRes.draft) {
        setDraftPlan(draftRes.draft.plan);
        setDraftVersionId(draftRes.draft.id);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    try {
      const result = await api.generate(prompt);

      const newPlan: Plan = {
        id: result.draftVersionId || generateId(),
        rules: result.config.map((r) => ({ ...r, id: r.id || generateId() })) as Rule[],
        createdAt: new Date().toISOString(),
      };

      setDraftPlan(newPlan);
      setDraftVersionId(result.draftVersionId);
      setInsights(result.insights);
      setTodos(result.todos || []);
      setNotes(result.notes || []);
      setPlaybook(result.playbook);
      setToolTrace(result.trace || []);
    } catch (error) {
      console.error('Generate failed:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const promote = useCallback(async () => {
    if (!draftVersionId) return;

    setIsPromoting(true);
    try {
      const result = await api.promote(draftVersionId);
      setActivePlan(result.active);
      setDraftPlan(null);
      setDraftVersionId(null);
      setInsights(null);
    } catch (error) {
      console.error('Promote failed:', error);
      throw error;
    } finally {
      setIsPromoting(false);
    }
  }, [draftVersionId]);

  const rollback = useCallback(async (versionId: string) => {
    try {
      const result = await api.rollback(versionId);
      setActivePlan(result.active);
      setDraftPlan(null);
      setDraftVersionId(null);
      setInsights(null);
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }, []);

  const simulate = useCallback(async () => {
    if (!draftPlan) return;

    try {
      const result = await api.simulate(draftPlan, activePlan?.id);
      setInsights((prev) => ({
        summary: result.summary,
        validation: prev?.validation || { valid: true, errors: [], warnings: [] },
        risk: prev?.risk || null,
        riskAudit: prev?.riskAudit,
      }));
    } catch (error) {
      console.error('Simulate failed:', error);
    }
  }, [draftPlan, activePlan?.id]);

  const discardDraft = useCallback(() => {
    setDraftPlan(null);
    setDraftVersionId(null);
    setInsights(null);
    setTodos([]);
    setNotes([]);
    setPlaybook(null);
    setToolTrace([]);
  }, []);

  const updateRule = useCallback((ruleId: string, updates: Partial<Rule>) => {
    setDraftPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rules: prev.rules.map((r) =>
          r.id === ruleId ? { ...r, ...updates } as Rule : r
        ),
      };
    });
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setDraftPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rules: prev.rules.filter((r) => r.id !== ruleId),
      };
    });
  }, []);

  const addRule = useCallback((rule: Rule) => {
    setDraftPlan((prev) => {
      if (!prev) {
        return {
          id: generateId(),
          rules: [{ ...rule, id: rule.id || generateId() }],
          createdAt: new Date().toISOString(),
        };
      }
      return {
        ...prev,
        rules: [...prev.rules, { ...rule, id: rule.id || generateId() }],
      };
    });
  }, []);

  const reorderRules = useCallback((fromIndex: number, toIndex: number) => {
    setDraftPlan((prev) => {
      if (!prev) return prev;
      const rules = [...prev.rules];
      const [removed] = rules.splice(fromIndex, 1);
      rules.splice(toIndex, 0, removed);
      return { ...prev, rules };
    });
  }, []);

  // Playbook management
  const startPlaybook = useCallback(async (scenario: PlaybookScenario, steps: PlaybookStep[], rules: Rule[]) => {
    // Create the playbook
    const newPlaybook: Playbook = {
      id: generateId(),
      title: `${scenario.charAt(0).toUpperCase()}${scenario.slice(1)} Setup`,
      scenario,
      steps: steps.map((step, index) => ({
        ...step,
        status: index === 0 ? 'running' : 'pending',
      })),
      activeStepIndex: 0,
      startedAt: new Date().toISOString(),
    };
    setPlaybook(newPlaybook);

    // Create draft plan with rules
    const newPlan: Plan = {
      id: generateId(),
      rules: rules.map((rule) => ({ ...rule, id: rule.id || generateId() })),
      createdAt: new Date().toISOString(),
      summary: `${scenario} configuration playbook`,
    };
    setDraftPlan(newPlan);

    // Save to backend so it can be promoted
    try {
      const result = await api.saveDraft(newPlan, `${scenario} playbook configuration`);
      if (result.draft) {
        setDraftVersionId(result.draft.id);
      }
    } catch (error) {
      console.error('Failed to save playbook draft:', error);
    }
  }, []);

  const advancePlaybookStep = useCallback(() => {
    setPlaybook((prev) => {
      if (!prev) return prev;

      const currentIndex = prev.activeStepIndex;
      const steps = [...prev.steps];

      // Mark current step as completed
      if (steps[currentIndex]) {
        steps[currentIndex] = { ...steps[currentIndex], status: 'completed' };
      }

      // Check if we've completed all steps
      const nextIndex = currentIndex + 1;
      if (nextIndex >= steps.length) {
        return {
          ...prev,
          steps,
          activeStepIndex: steps.length,
          completedAt: new Date().toISOString(),
        };
      }

      // Mark next step as running
      steps[nextIndex] = { ...steps[nextIndex], status: 'running' };

      return {
        ...prev,
        steps,
        activeStepIndex: nextIndex,
      };
    });
  }, []);

  const cancelPlaybook = useCallback(() => {
    setPlaybook(null);
  }, []);

  return {
    activePlan,
    draftPlan,
    draftVersionId,
    insights,
    todos,
    notes,
    playbook,
    toolTrace,
    isLoading,
    isGenerating,
    isPromoting,
    generate,
    promote,
    rollback,
    simulate,
    discardDraft,
    updateRule,
    removeRule,
    addRule,
    reorderRules,
    startPlaybook,
    advancePlaybookStep,
    cancelPlaybook,
    refresh,
  };
}
