import type { ParagraphRecord } from "shared";

import { paragraphMatchesFocus } from "@/lib/format";

type ParagraphListProps = {
  paragraphs: ParagraphRecord[];
  focusRange: { start: number | null; end: number | null } | null;
};

export function ParagraphList({ paragraphs, focusRange }: ParagraphListProps) {
  return (
    <section className="paper-panel rounded-[30px] px-5 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--ink-500)] uppercase">
            Paragraph Reader
          </p>
          <p className="text-[13px] text-[var(--ink-700)]">
            Review the cited authority in canonical paragraph order.
          </p>
        </div>
        {focusRange ? (
          <span className="rounded-full bg-[var(--surface-3)] px-3 py-1 font-mono text-[11px] text-[var(--brand-700)]">
            Focus {focusRange.start ?? "?"}-{focusRange.end ?? "?"}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {paragraphs.map((paragraph) => {
          const isFocused = paragraphMatchesFocus(paragraph, focusRange);
          return (
            <article
              className={`rounded-2xl border px-4 py-4 transition-colors ${
                isFocused
                  ? "border-[var(--brand-500)] bg-[rgba(126,165,255,0.12)]"
                  : "border-[var(--line-soft)] bg-white"
              }`}
              id={`paragraph-${paragraph.paragraphNo ?? paragraph.paragraphOrder}`}
              key={paragraph.id}
              style={{ scrollMarginTop: "112px" }}
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 shrink-0 rounded-full bg-[var(--surface-0)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink-500)]">
                  ¶ {paragraph.paragraphNo ?? paragraph.paragraphOrder}
                </div>
                <p className="text-[14px] leading-7 text-[var(--ink-700)]">
                  {paragraph.paragraphText}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
