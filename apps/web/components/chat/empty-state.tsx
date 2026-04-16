"use client";

import { SuggestedPromptCard } from "./suggested-prompt-card";

type EmptyStateProps = {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
};

export function EmptyState({ prompts, onSelectPrompt }: EmptyStateProps) {
  return (
    <section className="flex min-h-[calc(100vh-210px)] flex-1 items-center justify-center px-5 pb-40 pt-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
        <div className="brand-orb glass-panel inline-flex items-center gap-3 rounded-full px-4 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)] text-[11px] font-semibold tracking-[0.18em] text-[var(--brand-700)] uppercase">
            AI
          </span>
          <span className="text-[15px] font-semibold text-[var(--ink-950)]">
            CaseBase AI
          </span>
        </div>
        <div className="space-y-4">
          <h1 className="balanced-text text-4xl font-semibold tracking-[-0.04em] text-[var(--ink-950)] sm:text-5xl">
            Grounded legal research, shaped like a conversation.
          </h1>
          <p className="balanced-text mx-auto max-w-xl text-[15px] leading-7 text-[var(--ink-700)] sm:text-base">
            Ask questions, compare authorities, and trace every answer back to
            real cases, citations, and paragraph ranges.
          </p>
        </div>
        <div className="grid w-full gap-3 pt-2 sm:grid-cols-2">
          {prompts.map((prompt) => (
            <SuggestedPromptCard
              key={prompt}
              onSelect={onSelectPrompt}
              prompt={prompt}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
