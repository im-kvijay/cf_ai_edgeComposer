import type { JSX } from "react";
import type { ChatMessage } from "@/types/app";
import type { ResearchNote, TodoEntry } from "@/shared-types";

export interface ChatViewProps {
  messages: ChatMessage[];
  todos: TodoEntry[];
  notes: ResearchNote[];
  renderToolMessage: (
    toolMessage: Extract<ChatMessage, { role: "tool" }>
  ) => JSX.Element | null;
}

export function ChatView({
  messages,
  todos,
  notes,
  renderToolMessage
}: ChatViewProps) {
  return (
    <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
        Conversation
      </div>
      <div className="max-h-56 space-y-2 overflow-auto text-sm">
        {messages.length === 0 ? (
          <div className="text-neutral-500">No messages yet.</div>
        ) : (
          messages.map((message) => {
            const label =
              message.role === "user"
                ? "User"
                : message.role === "assistant"
                  ? "Assistant"
                  : "Tool";
            const roleTone =
              message.role === "user"
                ? "bg-blue-50 dark:bg-blue-900/20"
                : message.role === "tool"
                  ? "bg-neutral-100 dark:bg-neutral-900/60"
                  : "bg-green-50 dark:bg-green-900/20";
            return (
              <div key={message.id} className={`rounded p-2 ${roleTone}`}>
                <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
                  {label}
                </div>
                <div className="whitespace-pre-wrap break-words text-neutral-800 dark:text-neutral-200">
                  {message.role === "tool"
                    ? renderToolMessage(message)
                    : message.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {(todos.length > 0 || notes.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          {todos.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Todo
              </div>
              <ul className="space-y-1 text-sm">
                {todos.map((todo) => (
                  <li
                    key={todo.id}
                    className="flex items-center justify-between rounded bg-neutral-100 p-2 dark:bg-neutral-900/60"
                  >
                    <span
                      className={
                        todo.status === "done"
                          ? "mr-2 line-through opacity-70"
                          : "mr-2"
                      }
                    >
                      {todo.text}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${todo.status === "done" ? "bg-green-600 text-white" : "bg-yellow-600 text-white"}`}
                    >
                      {todo.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {notes.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Research
              </div>
              <ul className="space-y-1 text-sm">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded bg-neutral-100 p-2 dark:bg-neutral-900/60"
                  >
                    {note.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
