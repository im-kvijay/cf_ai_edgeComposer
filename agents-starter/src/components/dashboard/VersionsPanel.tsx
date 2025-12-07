import { ArrowCounterClockwise, CheckCircle, Clock } from '@phosphor-icons/react';
import type { PlanVersion } from '../../types';
import { Panel } from '../layout/Panel';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { cn } from '../../utils/cn';
import { formatRelativeTime, formatDateTime } from '../../utils/formatters';

interface VersionsPanelProps {
  versions: PlanVersion[];
  activeVersionId: string | null;
  onRollback: (versionId: string) => void;
  onSelect?: (version: PlanVersion) => void;
  isLoading?: boolean;
}

export function VersionsPanel({
  versions,
  activeVersionId,
  onRollback,
  onSelect,
  isLoading = false,
}: VersionsPanelProps) {
  return (
    <Panel
      title="Version History"
      subtitle={`${versions.length} versions`}
      className="h-full flex flex-col"
      noPadding
    >
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <EmptyState
            icon={<Clock size={24} />}
            title="No versions yet"
            description="Versions will appear here after you promote a plan"
          />
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {versions.map((version, index) => {
              const isActive = version.id === activeVersionId;
              const isFirst = index === 0;

              return (
                <div
                  key={version.id}
                  className={cn(
                    'p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors',
                    isActive && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                  onClick={() => onSelect?.(version)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Version ID & Status */}
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                          {version.id.slice(0, 8)}
                        </code>
                        {isActive && (
                          <Badge variant="success" size="sm" dot>
                            Active
                          </Badge>
                        )}
                        {isFirst && !isActive && (
                          <Badge variant="info" size="sm">
                            Latest
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      {version.description && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                          {version.description}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {version.promotedAt && (
                          <span title={formatDateTime(version.promotedAt)}>
                            {formatRelativeTime(version.promotedAt)}
                          </span>
                        )}
                        {version.promotedBy && (
                          <span>by {version.promotedBy}</span>
                        )}
                        <span>{version.plan.rules.length} rules</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRollback(version.id);
                        }}
                        className="shrink-0"
                      >
                        <ArrowCounterClockwise size={14} />
                        <span className="ml-1">Rollback</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

export default VersionsPanel;
