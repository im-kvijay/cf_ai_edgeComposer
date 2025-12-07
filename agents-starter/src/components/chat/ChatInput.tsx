import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { PaperPlaneRight, CircleNotch, Lightning } from '@phosphor-icons/react';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const SUGGESTED_PROMPTS = [
  'Cache images for 24 hours',
  'Add security headers',
  'Set up rate limiting for API',
  'Enable compression',
];

export function ChatInput({
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = 'Describe your CDN configuration needs...',
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSubmit(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="space-y-3">
      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSuggestionClick(prompt)}
            disabled={isLoading || disabled}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
              'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Lightning size={12} weight="fill" className="text-yellow-500" />
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading || disabled}
          rows={3}
          className={cn(
            'w-full px-4 py-3 pr-24 rounded-xl border resize-none',
            'bg-white dark:bg-neutral-900',
            'text-sm text-neutral-900 dark:text-neutral-100',
            'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
            'border-neutral-300 dark:border-neutral-700',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        <div className="absolute right-3 bottom-3">
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isLoading || disabled}
            isLoading={isLoading}
          >
            {isLoading ? (
              'Generating...'
            ) : (
              <>
                Generate
                <PaperPlaneRight size={14} weight="bold" />
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
        Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}

export default ChatInput;
