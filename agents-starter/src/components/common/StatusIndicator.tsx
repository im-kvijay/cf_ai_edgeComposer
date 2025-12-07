import { cn } from '../../utils/cn';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'warning';

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const statusStyles: Record<Status, { dot: string; text: string }> = {
  idle: {
    dot: 'bg-neutral-400',
    text: 'text-neutral-500 dark:text-neutral-400',
  },
  loading: {
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    dot: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
  },
  error: {
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
  },
  warning: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-400',
  },
};

const sizeStyles = {
  sm: { dot: 'h-1.5 w-1.5', text: 'text-xs' },
  md: { dot: 'h-2 w-2', text: 'text-sm' },
  lg: { dot: 'h-2.5 w-2.5', text: 'text-base' },
};

export function StatusIndicator({
  status,
  label,
  size = 'md',
  pulse = false,
}: StatusIndicatorProps) {
  const shouldPulse = pulse || status === 'loading';

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex">
        <span
          className={cn(
            'rounded-full',
            statusStyles[status].dot,
            sizeStyles[size].dot
          )}
        />
        {shouldPulse && (
          <span
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-75',
              statusStyles[status].dot
            )}
          />
        )}
      </span>
      {label && (
        <span className={cn('font-medium', statusStyles[status].text, sizeStyles[size].text)}>
          {label}
        </span>
      )}
    </div>
  );
}

export default StatusIndicator;
