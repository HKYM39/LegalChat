import Link from "next/link";
import type { SupportingExcerpt } from "shared";

import { buildDocumentParagraphHref, formatParagraphRange } from "@/lib/format";

type EvidenceSectionProps = {
  excerpts: SupportingExcerpt[];
};

export function EvidenceSection({ excerpts }: EvidenceSectionProps) {
  if (excerpts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--ink-500)] uppercase">
        Supporting Excerpts
      </p>
      <div className="space-y-3">
        {excerpts.map((excerpt) => (
          <Link
            className="block rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-0)] px-4 py-3 transition-colors hover:border-[var(--brand-500)] hover:bg-white"
            href={buildDocumentParagraphHref({
              documentId: excerpt.traceability.documentId,
              traceability: excerpt.traceability,
            })}
            key={`${excerpt.traceability.chunkId}-${excerpt.label}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 font-mono text-[11px] text-[var(--brand-700)]">
                {excerpt.label}
              </span>
              <span className="font-mono text-[11px] text-[var(--ink-500)]">
                {formatParagraphRange(excerpt.traceability)}
              </span>
            </div>
            <p className="text-[13px] leading-6 text-[var(--ink-700)]">
              {excerpt.excerpt}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
