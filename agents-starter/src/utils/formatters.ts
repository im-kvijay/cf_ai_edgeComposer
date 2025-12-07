import type { Rule, RuleType } from '../types';

// ============================================================================
// ID GENERATION
// ============================================================================

export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// STRING FORMATTERS
// ============================================================================

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// DATE FORMATTERS
// ============================================================================

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}

// ============================================================================
// RULE FORMATTERS
// ============================================================================

export function getRulePath(rule: Rule): string | undefined {
  if ('path' in rule && typeof rule.path === 'string') return rule.path;
  if ('from' in rule && typeof rule.from === 'string') return rule.from;
  return undefined;
}

export function getRuleTitle(rule: Rule): string {
  const path = getRulePath(rule);
  if (path) return `${formatLabel(rule.type)}: ${path}`;
  return formatLabel(rule.type);
}

export function getRuleSubtitle(rule: Rule): string {
  switch (rule.type) {
    case 'cache':
      return `TTL: ${formatDuration(rule.ttl)}`;
    case 'header':
      return `${rule.action} ${rule.name}`;
    case 'route':
      return `${rule.ruleType} → ${rule.to}`;
    case 'rate-limit':
      return `${rule.requestsPerMinute} req/min`;
    case 'canary':
      return `${(rule.percentage * 100).toFixed(0)}% traffic`;
    case 'security':
      return rule.csp ? 'CSP enabled' : 'Security headers';
    default:
      return rule.description || '';
  }
}

export function getRuleTypeColor(type: RuleType): string {
  const colors: Record<RuleType, string> = {
    'cache': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    'header': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    'route': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    'access': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    'performance': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    'image': 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
    'rate-limit': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    'bot-protection': 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
    'geo-routing': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    'security': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    'canary': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    'banner': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    'origin-shield': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
    'transform': 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  };
  return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300';
}

// ============================================================================
// NUMBER FORMATTERS
// ============================================================================

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// RISK FORMATTERS
// ============================================================================

export function getRiskColor(classification: string): string {
  switch (classification) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'moderate':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'elevated':
      return 'text-orange-600 dark:text-orange-400';
    case 'high':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

export function getRiskBgColor(classification: string): string {
  switch (classification) {
    case 'low':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'moderate':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case 'elevated':
      return 'bg-orange-100 dark:bg-orange-900/30';
    case 'high':
      return 'bg-red-100 dark:bg-red-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30';
  }
}
