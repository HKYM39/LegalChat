"use client";

type SuggestedPromptCardProps = {
  prompt: string;
  onSelect: (prompt: string) => void;
};

export function SuggestedPromptCard({
  prompt,
  onSelect,
}: SuggestedPromptCardProps) {
  return (
    <button
      className="paper-panel flex min-h-[74px] items-start rounded-2xl px-4 py-3 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-[var(--brand-500)] hover:bg-white"
      onClick={() => onSelect(prompt)}
      type="button"
    >
      <span className="text-[13px] leading-6 text-[var(--ink-700)]">
        {prompt}
      </span>
    </button>
  );
}
