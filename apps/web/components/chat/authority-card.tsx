"use client";

import Link from "next/link";
import type { AuthorityResult } from "shared";

import {
  buildDocumentParagraphHref,
  formatAuthorityMeta,
  formatParagraphRange,
} from "@/lib/format";

type AuthorityCardProps = {
  authority: AuthorityResult;
  onSelect: (authority: AuthorityResult) => void;
};

export function AuthorityCard({ authority, onSelect }: AuthorityCardProps) {
  const href = buildDocumentParagraphHref({
    documentId: authority.documentId,
    traceability: authority.traceability,
  });

  return (
    <Link
      className="paper-panel block rounded-2xl px-4 py-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--brand-500)] hover:bg-white"
      href={href}
      onClick={() => onSelect(authority)}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-[var(--ink-950)]">
              {authority.title}
            </p>
            <p className="text-[12px] font-medium tracking-[0.14em] text-[var(--brand-700)] uppercase">
              {authority.neutralCitation ?? "Citation unavailable"}
            </p>
          </div>
          <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 font-mono text-[11px] text-[var(--brand-700)]">
            {formatParagraphRange(authority.traceability)}
          </span>
        </div>
        <p className="text-[12px] leading-5 text-[var(--ink-500)]">
          {formatAuthorityMeta(authority)}
        </p>
        <p className="line-clamp-3 text-[13px] leading-6 text-[var(--ink-700)]">
          {authority.snippet}
        </p>
      </div>
    </Link>
  );
}
