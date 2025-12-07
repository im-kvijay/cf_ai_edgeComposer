import {
  Stack,
  ClockCounterClockwise,
  Key,
  BookOpen,
  ChartBar,
} from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import type { ViewTab } from '../../types';

interface SidebarProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  ruleCounts?: { total: number; draft: number };
  versionCount?: number;
  tokenCount?: number;
}

interface NavItem {
  id: ViewTab;
  label: string;
  icon: typeof Stack;
  badge?: number;
}

export function Sidebar({
  activeTab,
  onTabChange,
  ruleCounts = { total: 0, draft: 0 },
  versionCount = 0,
  tokenCount = 0,
}: SidebarProps) {
  const navItems: NavItem[] = [
    {
      id: 'rules',
      label: 'Rules',
      icon: Stack,
      badge: ruleCounts.total,
    },
    {
      id: 'versions',
      label: 'Versions',
      icon: ClockCounterClockwise,
      badge: versionCount,
    },
    {
      id: 'tokens',
      label: 'Tokens',
      icon: Key,
      badge: tokenCount,
    },
    {
      id: 'playbooks',
      label: 'Playbooks',
      icon: BookOpen,
    },
  ];

  return (
    <aside className="w-48 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
              )}
            >
              <Icon
                size={18}
                weight={isActive ? 'fill' : 'regular'}
                className={isActive ? 'text-blue-600 dark:text-blue-400' : ''}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    isActive
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200'
                      : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Stats */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <ChartBar size={14} />
          <span>
            {ruleCounts.total} rules
            {ruleCounts.draft > 0 && ` (${ruleCounts.draft} draft)`}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
