import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  noPadding?: boolean;
}

export function Panel({
  children,
  className,
  title,
  subtitle,
  action,
  noPadding = false,
}: PanelProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800',
        'overflow-hidden',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </div>
  );
}

interface PanelSectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function PanelSection({ children, title, className }: PanelSectionProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {title && (
        <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}

export default Panel;
