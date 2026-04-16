import type { AuthorityResult, ParagraphRecord, TraceabilityRef } from "shared";

export function formatDecisionDate(date: string | null) {
  if (!date) {
    return "Date unavailable";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function formatParagraphRange(traceability: TraceabilityRef) {
  const { paragraphStartNo, paragraphEndNo } = traceability;

  if (paragraphStartNo == null && paragraphEndNo == null) {
    return "Paragraph range unavailable";
  }

  if (paragraphStartNo != null && paragraphEndNo != null) {
    return paragraphStartNo === paragraphEndNo
      ? `Paragraph ${paragraphStartNo}`
      : `Paragraphs ${paragraphStartNo}-${paragraphEndNo}`;
  }

  return `Paragraph ${paragraphStartNo ?? paragraphEndNo}`;
}

export function formatAuthorityMeta(authority: AuthorityResult) {
  return [
    authority.court,
    authority.jurisdiction,
    formatDecisionDate(authority.decisionDate),
  ]
    .filter(Boolean)
    .join(" • ");
}

export function getFocusParagraphNo(
  traceability: Pick<TraceabilityRef, "paragraphStartNo" | "paragraphEndNo">,
) {
  return traceability.paragraphStartNo ?? traceability.paragraphEndNo ?? null;
}

export function buildDocumentParagraphHref(input: {
  documentId: string;
  traceability: Pick<
    TraceabilityRef,
    "paragraphStartNo" | "paragraphEndNo" | "chunkId"
  >;
}) {
  const focusParagraphNo = getFocusParagraphNo(input.traceability);

  return {
    pathname: `/documents/${input.documentId}`,
    query: {
      paragraphStart: input.traceability.paragraphStartNo ?? undefined,
      paragraphEnd: input.traceability.paragraphEndNo ?? undefined,
      chunkId: input.traceability.chunkId,
    },
    hash: focusParagraphNo != null ? `paragraph-${focusParagraphNo}` : undefined,
  };
}

export function paragraphMatchesFocus(
  paragraph: ParagraphRecord,
  focus?: { start: number | null; end: number | null } | null,
) {
  if (!focus || paragraph.paragraphNo == null) {
    return false;
  }

  const start = focus.start ?? focus.end;
  const end = focus.end ?? focus.start;
  if (start == null || end == null) {
    return false;
  }

  return paragraph.paragraphNo >= start && paragraph.paragraphNo <= end;
}
