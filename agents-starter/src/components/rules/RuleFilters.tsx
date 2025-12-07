import { MagnifyingGlass, Funnel } from '@phosphor-icons/react';
import type { RuleType } from '../../types';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { cn } from '../../utils/cn';

interface RuleFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTypes: RuleType[];
  onTypeToggle: (type: RuleType) => void;
  typeCounts: Record<RuleType, number>;
}

const RULE_TYPES: RuleType[] = [
  'cache',
  'header',
  'route',
  'access',
  'performance',
  'image',
  'rate-limit',
  'bot-protection',
  'geo-routing',
  'security',
  'canary',
  'banner',
  'origin-shield',
  'transform',
];

export function RuleFilters({
  search,
  onSearchChange,
  selectedTypes,
  onTypeToggle,
  typeCounts,
}: RuleFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search rules..."
          className={cn(
            'w-full pl-9 pr-3 py-2 rounded-lg border text-sm',
            'bg-white dark:bg-neutral-900',
            'border-neutral-300 dark:border-neutral-700',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          )}
        />
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Funnel size={14} className="text-neutral-400" />
        {RULE_TYPES.filter((type) => typeCounts[type] > 0).map((type) => {
          const isSelected = selectedTypes.includes(type);
          const count = typeCounts[type] || 0;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onTypeToggle(type)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                isSelected
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              {type}
              <span
                className={cn(
                  'text-[10px] px-1 rounded',
                  isSelected
                    ? 'bg-blue-200 dark:bg-blue-800'
                    : 'bg-neutral-200 dark:bg-neutral-700'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RuleFilters;
