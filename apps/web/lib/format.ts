/**
 * 格式化工具函数 (Formatting Utilities)
 * 
 * 职责：
 * 1. 处理法律判例相关的日期、段落范围及元数据格式化。
 * 2. 构建用于页面跳转的 URL 对象。
 * 3. 提供段落匹配逻辑，用于详情页高亮。
 */

import type { AuthorityResult, ParagraphRecord, TraceabilityRef } from "shared";

/**
 * 格式化判决日期 (Decision Date)
 * 例如: "2025-02-05" -> "Feb 5, 2025"
 */
export function formatDecisionDate(date: string | null) {
  if (!date) {
    return "日期不可用";
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

/**
 * 格式化段落范围引用 (Paragraph Range)
 * 处理单段落、多段落范围及缺失情况
 */
export function formatParagraphRange(traceability: TraceabilityRef) {
  const { paragraphStartNo, paragraphEndNo } = traceability;

  if (paragraphStartNo == null && paragraphEndNo == null) {
    return "段落引用不可用";
  }

  if (paragraphStartNo != null && paragraphEndNo != null) {
    return paragraphStartNo === paragraphEndNo
      ? `Paragraph ${paragraphStartNo}`
      : `Paragraphs ${paragraphStartNo}-${paragraphEndNo}`;
  }

  return `Paragraph ${paragraphStartNo ?? paragraphEndNo}`;
}

/**
 * 格式化法律权威元数据行
 * 组合法院、管辖区和日期
 */
export function formatAuthorityMeta(authority: AuthorityResult) {
  return [
    authority.court,
    authority.jurisdiction,
    formatDecisionDate(authority.decisionDate),
  ]
    .filter(Boolean)
    .join(" • ");
}

/**
 * 获取关注的段落编号（用于锚点定位）
 */
export function getFocusParagraphNo(
  traceability: Pick<TraceabilityRef, "paragraphStartNo" | "paragraphEndNo">,
) {
  return traceability.paragraphStartNo ?? traceability.paragraphEndNo ?? null;
}

/**
 * 构建判例详情页的跳转链接 (带有段落锚点和范围参数)
 * 用于从聊天中的 AuthorityCard 跳转到 Case Detail Page
 */
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
    // 使用 hash 实现页面自动滚动到指定段落
    hash: focusParagraphNo != null ? `paragraph-${focusParagraphNo}` : undefined,
  };
}

/**
 * 判断某个段落是否属于当前的关注范围 (Focus Range)
 * 用于在 ParagraphList 中高亮渲染
 */
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
