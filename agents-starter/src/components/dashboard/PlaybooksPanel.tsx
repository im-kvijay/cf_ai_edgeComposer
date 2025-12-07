import {
  ShoppingCart,
  Article,
  Code,
  FileHtml,
  Play,
  CheckCircle,
  Circle,
  Spinner,
  X,
  ArrowRight,
} from '@phosphor-icons/react';
import type { Playbook, PlaybookScenario } from '../../types';
import { Panel, PanelSection } from '../layout/Panel';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { cn } from '../../utils/cn';

interface PlaybooksPanelProps {
  activePlaybook: Playbook | null;
  onStartPlaybook: (scenario: PlaybookScenario) => void;
  onAdvanceStep: () => void;
  onCancelPlaybook?: () => void;
  isLoading?: boolean;
}

const PLAYBOOK_OPTIONS: Array<{
  id: PlaybookScenario;
  label: string;
  description: string;
  icon: typeof ShoppingCart;
}> = [
  {
    id: 'ecommerce',
    label: 'E-commerce',
    description: 'Optimized for product pages and checkout',
    icon: ShoppingCart,
  },
  {
    id: 'blog',
    label: 'Blog / Content',
    description: 'Cache-heavy setup for editorial sites',
    icon: Article,
  },
  {
    id: 'api',
    label: 'API Service',
    description: 'Rate limiting and security hardening',
    icon: Code,
  },
  {
    id: 'static',
    label: 'Static Site',
    description: 'Maximum caching for JAMstack sites',
    icon: FileHtml,
  },
];

export function PlaybooksPanel({
  activePlaybook,
  onStartPlaybook,
  onAdvanceStep,
  onCancelPlaybook,
  isLoading = false,
}: PlaybooksPanelProps) {
  const isCompleted = activePlaybook && activePlaybook.activeStepIndex >= activePlaybook.steps.length;

  return (
    <Panel title="Playbooks" className="h-full overflow-y-auto" noPadding>
      <div className="p-4 space-y-4">
        {/* Playbook Options */}
        <PanelSection title={activePlaybook ? 'Active Playbook' : 'Quick Start'}>
          <div className="grid grid-cols-2 gap-2">
            {PLAYBOOK_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = activePlaybook?.scenario === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onStartPlaybook(option.id)}
                  disabled={isLoading}
                  className={cn(
                    'flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-colors',
                    isActive
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Icon
                    size={20}
                    weight={isActive ? 'fill' : 'regular'}
                    className={
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-neutral-500'
                    }
                  />
                  <div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {option.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {option.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </PanelSection>

        {/* Active Playbook Progress */}
        {activePlaybook && (
          <PanelSection title="Progress">
            <div className="space-y-2">
              {activePlaybook.steps.map((step, index) => {
                const isActive = index === activePlaybook.activeStepIndex;
                const isCompleted = step.status === 'completed';
                const isRunning = step.status === 'running';

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg',
                      isActive && 'bg-blue-50 dark:bg-blue-900/20',
                      isCompleted && 'opacity-60'
                    )}
                  >
                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle
                          size={18}
                          weight="fill"
                          className="text-green-500"
                        />
                      ) : isRunning ? (
                        <Spinner size={18} className="text-blue-500 animate-spin" />
                      ) : (
                        <Circle size={18} className="text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          isCompleted
                            ? 'text-neutral-500 dark:text-neutral-400'
                            : 'text-neutral-900 dark:text-neutral-100'
                        )}
                      >
                        {step.title}
                      </div>
                      {step.description && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {step.description}
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <Badge variant="primary" size="sm">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              {!isCompleted && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onAdvanceStep}
                    disabled={isLoading}
                    leftIcon={
                      activePlaybook.activeStepIndex >= activePlaybook.steps.length - 1
                        ? <CheckCircle size={14} weight="fill" />
                        : <ArrowRight size={14} weight="bold" />
                    }
                    className="flex-1"
                  >
                    {activePlaybook.activeStepIndex >= activePlaybook.steps.length - 1
                      ? 'Complete'
                      : 'Next Step'}
                  </Button>
                  {onCancelPlaybook && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancelPlaybook}
                      disabled={isLoading}
                      leftIcon={<X size={14} />}
                    >
                      Cancel
                    </Button>
                  )}
                </>
              )}
              {isCompleted && (
                <div className="flex-1 text-center py-2">
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle size={20} weight="fill" />
                    <span className="font-medium">Playbook Complete!</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Review your rules and promote when ready.
                  </p>
                  {onCancelPlaybook && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCancelPlaybook}
                      className="mt-2"
                    >
                      Start New Playbook
                    </Button>
                  )}
                </div>
              )}
            </div>
          </PanelSection>
        )}
      </div>
    </Panel>
  );
}

export default PlaybooksPanel;
