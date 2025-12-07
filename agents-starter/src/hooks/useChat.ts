import { useState, useCallback } from 'react';
import type { ChatMessage, UserMessage, AssistantMessage, ToolMessage, ToolTrace } from '../types';
import { generateId } from '../utils/formatters';

interface UseChatReturn {
  messages: ChatMessage[];
  addUserMessage: (content: string) => void;
  addAssistantMessage: (content: string) => void;
  addToolMessages: (traces: ToolTrace[]) => void;
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addUserMessage = useCallback((content: string) => {
    const message: UserMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  const addAssistantMessage = useCallback((content: string) => {
    const message: AssistantMessage = {
      id: generateId(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  const addToolMessages = useCallback((traces: ToolTrace[]) => {
    const toolMessages: ToolMessage[] = traces.map((trace) => ({
      id: trace.id || generateId(),
      role: 'tool' as const,
      toolName: trace.label,
      status: trace.status === 'success' ? 'success' : 'error',
      input: trace.input,
      output: trace.output,
      timestamp: trace.finishedAt || new Date().toISOString(),
    }));
    setMessages((prev) => [...prev, ...toolMessages]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    addUserMessage,
    addAssistantMessage,
    addToolMessages,
    clearMessages,
  };
}
