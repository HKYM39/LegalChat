import type { DocumentResponse } from "shared";

import { formatDecisionDate } from "@/lib/format";

type CaseMetadataProps = {
  document: DocumentResponse;
};

export function CaseMetadata({ document }: CaseMetadataProps) {
  return (
    <section className="glass-panel rounded-[30px] px-6 py-6 sm:px-7">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--ink-500)] uppercase">
            Authority Record
          </p>
          <h1 className="balanced-text text-3xl font-semibold tracking-[-0.04em] text-[var(--ink-950)] sm:text-[2.4rem]">
            {document.title}
          </h1>
          <p className="font-mono text-[12px] text-[var(--brand-700)]">
            {document.neutralCitation ?? "Citation unavailable"}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[rgba(255,255,255,0.58)] px-4 py-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
              Court
            </dt>
            <dd className="pt-1 text-[14px] text-[var(--ink-950)]">
              {document.court ?? "Unavailable"}
            </dd>
          </div>
          <div className="rounded-2xl bg-[rgba(255,255,255,0.58)] px-4 py-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
              Jurisdiction
            </dt>
            <dd className="pt-1 text-[14px] text-[var(--ink-950)]">
              {document.jurisdiction ?? "Unavailable"}
            </dd>
          </div>
          <div className="rounded-2xl bg-[rgba(255,255,255,0.58)] px-4 py-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
              Decision Date
            </dt>
            <dd className="pt-1 text-[14px] text-[var(--ink-950)]">
              {formatDecisionDate(document.decisionDate)}
            </dd>
          </div>
          <div className="rounded-2xl bg-[rgba(255,255,255,0.58)] px-4 py-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
              Status
            </dt>
            <dd className="pt-1 text-[14px] text-[var(--ink-950)]">
              {document.parseStatus} / {document.indexingStatus}
            </dd>
          </div>
        </dl>

        <div className="rounded-[24px] border border-[var(--line-soft)] bg-[var(--surface-2)] px-5 py-4">
          <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--ink-500)] uppercase">
            Summary
          </p>
          <p className="pt-2 text-[14px] leading-7 text-[var(--ink-700)]">
            {document.summaryText ??
              "No canonical summary is available for this authority yet."}
          </p>
        </div>
      </div>
    </section>
  );
}
