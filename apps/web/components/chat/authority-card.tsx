/**
 * 权威案例卡片组件 (AuthorityCard)
 * 
 * 用于在聊天对话中展示系统检索到的一条法律引用（Authority）。
 * 点击后将跳转到案例详情页 (Case Detail Page) 以供用户核验原始段落。
 */
"use client";

import Link from "next/link";
import type { AuthorityResult } from "shared";

import {
  buildDocumentParagraphHref,
  formatAuthorityMeta,
  formatParagraphRange,
} from "@/lib/format";

type AuthorityCardProps = {
  // 单条法律权威数据
  authority: AuthorityResult;
  // 卡片点击回调
  onSelect: (authority: AuthorityResult) => void;
};

export function AuthorityCard({ authority, onSelect }: AuthorityCardProps) {
  // 构建跳转链接：案件详情页 + 可选的段落高亮锚点
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
            {/* 案件标题 */}
            <p className="text-[15px] font-semibold text-[var(--ink-950)]">
              {authority.title}
            </p>
            {/* 中立引用号 */}
            <p className="text-[12px] font-medium tracking-[0.14em] text-[var(--brand-700)] uppercase">
              {authority.neutralCitation ?? "Citation unavailable"}
            </p>
          </div>
          {/* 段落追踪标识 (例如 [23]-[25]) */}
          <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 font-mono text-[11px] text-[var(--brand-700)]">
            {formatParagraphRange(authority.traceability)}
          </span>
        </div>
        {/* 元信息：法院和日期等 */}
        <p className="text-[12px] leading-5 text-[var(--ink-500)]">
          {formatAuthorityMeta(authority)}
        </p>
        {/* 段落摘录文本 (最多显示3行) */}
        <p className="line-clamp-3 text-[13px] leading-6 text-[var(--ink-700)]">
          {authority.snippet}
        </p>
      </div>
    </Link>
  );
}
