import { Moon, Sun, Gear, CloudArrowUp, CircleNotch } from '@phosphor-icons/react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { cn } from '../../utils/cn';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  isGenerating?: boolean;
  hasDraft?: boolean;
  activeVersionId?: string | null;
}

export function Header({
  isDark,
  onToggleTheme,
  onOpenSettings,
  isGenerating = false,
  hasDraft = false,
  activeVersionId,
}: HeaderProps) {
  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
          <CloudArrowUp size={18} weight="bold" className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            EdgeComposer
          </h1>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            AI-Powered CDN Configuration
          </p>
        </div>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-3">
        {isGenerating && (
          <Badge variant="primary" dot>
            <CircleNotch size={12} className="animate-spin mr-1" />
            Generating
          </Badge>
        )}
        {hasDraft && !isGenerating && (
          <Badge variant="warning" dot>
            Unsaved Draft
          </Badge>
        )}
        {activeVersionId && (
          <Badge variant="success" size="sm">
            v{activeVersionId.slice(0, 8)}
          </Badge>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Gear size={18} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </div>
    </header>
  );
}

export default Header;
