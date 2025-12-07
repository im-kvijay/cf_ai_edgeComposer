import { Key, Copy, Trash, Plus, Clock } from '@phosphor-icons/react';
import type { PreviewToken } from '../../types';
import { Panel } from '../layout/Panel';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { formatRelativeTime, formatDateTime } from '../../utils/formatters';

interface TokensPanelProps {
  tokens: PreviewToken[];
  activeVersionId: string | null;
  onCreateToken: () => void;
  onDeleteToken: (token: string) => void;
  onCopyUrl: (token: string) => void;
  isCreating?: boolean;
}

export function TokensPanel({
  tokens,
  activeVersionId,
  onCreateToken,
  onDeleteToken,
  onCopyUrl,
  isCreating = false,
}: TokensPanelProps) {
  return (
    <Panel
      title="Preview Tokens"
      subtitle={`${tokens.length} active tokens`}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={onCreateToken}
          disabled={!activeVersionId || isCreating}
          isLoading={isCreating}
          leftIcon={<Plus size={14} />}
        >
          Create Token
        </Button>
      }
      className="h-full flex flex-col"
      noPadding
    >
      <div className="flex-1 overflow-y-auto">
        {tokens.length === 0 ? (
          <EmptyState
            icon={<Key size={24} />}
            title="No preview tokens"
            description="Create a token to share previews of your configuration"
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={onCreateToken}
                disabled={!activeVersionId}
                leftIcon={<Plus size={14} />}
              >
                Create Token
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {tokens.map((token) => {
              const isExpired = token.expiresAt && new Date(token.expiresAt) < new Date();

              return (
                <div
                  key={token.token}
                  className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Token */}
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                          {token.token.slice(0, 12)}...
                        </code>
                        {isExpired && (
                          <span className="text-[10px] text-red-500 font-medium">
                            EXPIRED
                          </span>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                        <span>v{token.versionId.slice(0, 8)}</span>
                        <span
                          className="flex items-center gap-1"
                          title={formatDateTime(token.createdAt)}
                        >
                          <Clock size={10} />
                          {formatRelativeTime(token.createdAt)}
                        </span>
                        {token.expiresAt && (
                          <span
                            title={`Expires: ${formatDateTime(token.expiresAt)}`}
                          >
                            Expires {formatRelativeTime(token.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCopyUrl(token.token)}
                        className="h-7 w-7 p-0"
                        aria-label="Copy preview URL"
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteToken(token.token)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="Delete token"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
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

export default TokensPanel;
