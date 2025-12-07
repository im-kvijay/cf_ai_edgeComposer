import { User, Robot, Wrench, CheckCircle, XCircle } from '@phosphor-icons/react';
import type { ChatMessage } from '../../types';
import { cn } from '../../utils/cn';
import { formatRelativeTime } from '../../utils/formatters';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
          <Robot size={32} className="text-blue-500" />
        </div>
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Ready to help
        </h3>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
          Describe what you'd like to configure and I'll generate the rules for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  switch (message.role) {
    case 'user':
      return <UserMessageItem message={message} />;
    case 'assistant':
      return <AssistantMessageItem message={message} />;
    case 'tool':
      return <ToolMessageItem message={message} />;
    default:
      return null;
  }
}

function UserMessageItem({ message }: { message: ChatMessage & { role: 'user' } }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
        <User size={14} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
            You
          </span>
          <span className="text-[10px] text-neutral-400">
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function AssistantMessageItem({ message }: { message: ChatMessage & { role: 'assistant' } }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
        <Robot size={14} className="text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
            EdgeComposer
          </span>
          <span className="text-[10px] text-neutral-400">
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function ToolMessageItem({ message }: { message: ChatMessage & { role: 'tool' } }) {
  const isSuccess = message.status === 'success';

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
          isSuccess
            ? 'bg-emerald-100 dark:bg-emerald-900/40'
            : 'bg-red-100 dark:bg-red-900/40'
        )}
      >
        <Wrench
          size={14}
          className={isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
            {message.toolName}
          </span>
          {isSuccess ? (
            <CheckCircle size={12} className="text-emerald-500" weight="fill" />
          ) : (
            <XCircle size={12} className="text-red-500" weight="fill" />
          )}
          <span className="text-[10px] text-neutral-400">
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>
        {message.output && (
          <pre className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-2 overflow-x-auto">
            {typeof message.output === 'string'
              ? message.output
              : JSON.stringify(message.output, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default MessageList;
