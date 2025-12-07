import {
  ShoppingCart,
  Article,
  Code,
  FileHtml,
  Play,
  CheckCircle,
  Circle,
  Spinner,
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
  isLoading = false,
}: PlaybooksPanelProps) {
  return (
    <Panel title="Playbooks" className="h-full overflow-y-auto" noPadding>
      <div className="p-4 space-y-4">
        {/* Playbook Options */}
        <PanelSection title="Quick Start">
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

            <div className="mt-4">
              <Button
                variant="primary"
                size="sm"
                onClick={onAdvanceStep}
                disabled={
                  isLoading ||
                  activePlaybook.activeStepIndex >= activePlaybook.steps.length
                }
                leftIcon={<Play size={14} weight="fill" />}
                className="w-full"
              >
                {activePlaybook.activeStepIndex >= activePlaybook.steps.length - 1
                  ? 'Complete'
                  : 'Advance Step'}
              </Button>
            </div>
          </PanelSection>
        )}
      </div>
    </Panel>
  );
}

export default PlaybooksPanel;
