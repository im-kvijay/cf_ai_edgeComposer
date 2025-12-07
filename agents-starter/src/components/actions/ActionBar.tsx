import {
  Play,
  CheckCircle,
  ArrowCounterClockwise,
  DownloadSimple,
  FloppyDisk,
} from '@phosphor-icons/react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

interface ActionBarProps {
  hasDraft: boolean;
  canPromote: boolean;
  canRollback: boolean;
  isGenerating: boolean;
  isPromoting: boolean;
  onSimulate: () => void;
  onPromote: () => void;
  onDiscard: () => void;
  onRollback: () => void;
  onExport: () => void;
}

export function ActionBar({
  hasDraft,
  canPromote,
  canRollback,
  isGenerating,
  isPromoting,
  onSimulate,
  onPromote,
  onDiscard,
  onRollback,
  onExport,
}: ActionBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        {hasDraft && (
          <Badge variant="warning" dot>
            Draft changes
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hasDraft ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSimulate}
              disabled={isGenerating || isPromoting}
              leftIcon={<Play size={14} />}
            >
              Simulate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              disabled={isGenerating || isPromoting}
            >
              Discard
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={onPromote}
              disabled={!canPromote || isGenerating || isPromoting}
              isLoading={isPromoting}
              leftIcon={<CheckCircle size={14} weight="fill" />}
            >
              Apply Changes
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              disabled={isGenerating}
              leftIcon={<DownloadSimple size={14} />}
            >
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRollback}
              disabled={!canRollback || isGenerating}
              leftIcon={<ArrowCounterClockwise size={14} />}
            >
              Rollback
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default ActionBar;
