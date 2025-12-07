import {
  ShieldCheck,
  Warning,
  XCircle,
  CheckCircle,
  Info,
  CaretDown,
} from '@phosphor-icons/react';
import type { PlanInsights, TodoItem, ResearchNote } from '../../types';
import { Panel, PanelSection } from '../layout/Panel';
import { Badge } from '../common/Badge';
import { cn } from '../../utils/cn';
import { getRiskColor, getRiskBgColor } from '../../utils/formatters';

interface InsightsPanelProps {
  insights: PlanInsights | null;
  todos: TodoItem[];
  notes: ResearchNote[];
}

export function InsightsPanel({ insights, todos, notes }: InsightsPanelProps) {
  const hasContent = insights || todos.length > 0 || notes.length > 0;

  if (!hasContent) {
    return (
      <Panel title="Insights" className="h-full">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Info size={24} className="text-neutral-400 mb-2" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Generate a plan to see insights
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Insights" className="h-full overflow-y-auto" noPadding>
      <div className="p-4 space-y-6">
        {/* Risk Score */}
        {insights?.risk && (
          <PanelSection title="Risk Assessment">
            <div
              className={cn(
                'rounded-lg p-4',
                getRiskBgColor(insights.risk.classification)
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    'text-2xl font-bold',
                    getRiskColor(insights.risk.classification)
                  )}
                >
                  {insights.risk.score}/100
                </span>
                <Badge
                  variant={
                    insights.risk.classification === 'low'
                      ? 'success'
                      : insights.risk.classification === 'high'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {insights.risk.classification.toUpperCase()}
                </Badge>
              </div>

              {insights.risk.reasons.length > 0 && (
                <ul className="space-y-1 mt-3">
                  {insights.risk.reasons.map((reason, i) => (
                    <li
                      key={i}
                      className="text-xs text-neutral-600 dark:text-neutral-400 flex items-start gap-2"
                    >
                      <span className="shrink-0 mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PanelSection>
        )}

        {/* Validation */}
        {insights?.validation && (
          <PanelSection title="Validation">
            <div className="space-y-2">
              {insights.validation.errors.length === 0 &&
              insights.validation.warnings.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle size={16} weight="fill" />
                  <span>No validation issues</span>
                </div>
              ) : (
                <>
                  {insights.validation.errors.map((error, i) => (
                    <div
                      key={`error-${i}`}
                      className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"
                    >
                      <XCircle size={14} weight="fill" className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {insights.validation.warnings.map((warning, i) => (
                    <div
                      key={`warning-${i}`}
                      className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-400"
                    >
                      <Warning size={14} weight="fill" className="shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </PanelSection>
        )}

        {/* Summary */}
        {insights?.summary && (
          <PanelSection title="Summary">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {insights.summary}
            </p>
          </PanelSection>
        )}

        {/* Todos */}
        {todos.length > 0 && (
          <PanelSection title="Todo">
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    todo.status === 'done'
                      ? 'text-neutral-400 line-through'
                      : 'text-neutral-700 dark:text-neutral-300'
                  )}
                >
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                      todo.status === 'done'
                        ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    )}
                  >
                    {todo.status === 'done' ? '✓' : '○'}
                  </span>
                  <span>{todo.text}</span>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}

        {/* Research Notes */}
        {notes.length > 0 && (
          <PanelSection title="Research">
            <ul className="space-y-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="text-sm text-neutral-600 dark:text-neutral-400 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded"
                >
                  {note.note}
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </div>
    </Panel>
  );
}

export default InsightsPanel;
