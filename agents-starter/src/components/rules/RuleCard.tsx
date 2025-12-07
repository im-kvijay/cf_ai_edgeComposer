import { useState } from 'react';
import { Trash, Copy, DotsThree } from '@phosphor-icons/react';
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
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function RuleCard({
  rule,
  index,
  isSelected = false,
  isDraft = false,
  onSelect,
  onDelete,
  onDuplicate,
}: RuleCardProps) {
  const [showActions, setShowActions] = useState(false);

  const hasActions = onDelete || onDuplicate;

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-3 transition-all cursor-pointer',
        isSelected
          ? 'border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/20'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700',
        isDraft && 'border-l-4 border-l-amber-400 dark:border-l-amber-500'
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
          {isDraft && (
            <Badge size="sm" variant="warning">
              draft
            </Badge>
          )}
        </div>

        {/* Actions Menu Button - Always visible */}
        {hasActions && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="h-6 w-6 p-0"
              aria-label="Rule actions"
            >
              <DotsThree size={16} weight="bold" />
            </Button>

            {/* Dropdown Menu */}
            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowActions(false);
                  }}
                />
                <div className="absolute right-0 top-7 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                  {onDuplicate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <Copy size={14} />
                      Duplicate
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                        setShowActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
