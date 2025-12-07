import { Trash, PencilSimple, Copy, DotsThreeVertical } from '@phosphor-icons/react';
import type { Rule } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';
import { getRuleTitle, getRuleSubtitle, getRuleTypeColor } from '../../utils/formatters';

interface RuleCardProps {
  rule: Rule;
  index: number;
  isSelected?: boolean;
  isDraft?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function RuleCard({
  rule,
  index,
  isSelected = false,
  isDraft = false,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
}: RuleCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-lg border p-3 transition-all cursor-pointer',
        isSelected
          ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/20'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700',
        isDraft && 'border-l-4 border-l-yellow-400 dark:border-l-yellow-500'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
            #{index + 1}
          </span>
          <Badge size="sm" className={getRuleTypeColor(rule.type)}>
            {rule.type}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-6 w-6 p-0"
              aria-label="Edit rule"
            >
              <PencilSimple size={14} />
            </Button>
          )}
          {onDuplicate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="h-6 w-6 p-0"
              aria-label="Duplicate rule"
            >
              <Copy size={14} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label="Delete rule"
            >
              <Trash size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Title & Subtitle */}
      <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
        {getRuleTitle(rule)}
      </h4>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
        {getRuleSubtitle(rule)}
      </p>

      {/* Description */}
      {rule.description && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 line-clamp-2">
          {rule.description}
        </p>
      )}
    </div>
  );
}

export default RuleCard;
