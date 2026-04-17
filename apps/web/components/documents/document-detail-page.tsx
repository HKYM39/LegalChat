/**
 * 案例详情页核心组件 (DocumentDetailPage)
 * 
 * 职责：
 * 1. 作为“引用核验页”，展示完整的法律案件信息和段落原文。
 * 2. 从 Zustand store 加载案件元数据和段落列表。
 * 3. 自动解析 URL 参数（paragraphStart, paragraphEnd）或 Hash 锚点，
 *    实现段落级的高亮和自动滚动 (Smooth scrolling)。
 */
"use client";

import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { BrandHeader } from "@/components/chat/brand-header";
import { CaseMetadata } from "@/components/documents/case-metadata";
import { ParagraphList } from "@/components/documents/paragraph-list";
import { getFocusParagraphNo } from "@/lib/format";
import { useDocumentStore } from "@/store/document-store";

type DocumentDetailPageProps = {
  documentId: string;
};

export function DocumentDetailPage({ documentId }: DocumentDetailPageProps) {
  const searchParams = useSearchParams();
  
  // 绑定来自 Zustand Store 的文档状态与操作
  const currentDocument = useDocumentStore((state) => state.currentDocument);
  const paragraphs = useDocumentStore((state) => state.paragraphs);
  const isLoading = useDocumentStore((state) => state.isLoading);
  const error = useDocumentStore((state) => state.error);
  const focusRange = useDocumentStore((state) => state.focusRange);
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  const reset = useDocumentStore((state) => state.reset);
  const setFocusRange = useDocumentStore((state) => state.setFocusRange);

  // 解析 URL 参数中的需要聚焦的段落范围
  const requestedFocusRange = useMemo(() => {
    const start = searchParams.get("paragraphStart");
    const end = searchParams.get("paragraphEnd");
    return {
      start: start ? Number.parseInt(start, 10) : null,
      end: end ? Number.parseInt(end, 10) : null,
    };
  }, [searchParams]);

  // 组件挂载时加载文档，卸载时清理状态
  useEffect(() => {
    loadDocument(documentId);
    return () => reset();
  }, [documentId, loadDocument, reset]);

  // 将 URL 参数同步到状态管理中，以便触发高亮
  useEffect(() => {
    setFocusRange(requestedFocusRange);
  }, [requestedFocusRange, setFocusRange]);

  // 自动滚动逻辑：处理来自聊天页面的跳转定位
  useEffect(() => {
    if (isLoading || paragraphs.length === 0) {
      return;
    }

    const focusParagraphNo = getFocusParagraphNo({
      paragraphStartNo: focusRange?.start ?? null,
      paragraphEndNo: focusRange?.end ?? null,
    });
    
    // 优先使用 hash 锚点，回退使用解析出的 focus 范围
    const hashTargetId =
      typeof window !== "undefined" && window.location.hash
        ? window.location.hash.slice(1)
        : null;
    const targetId =
      hashTargetId || (focusParagraphNo != null ? `paragraph-${focusParagraphNo}` : null);

    if (!targetId) {
      return;
    }

    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }

      // 平滑滚动至目标段落
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [focusRange, isLoading, paragraphs.length]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
      <BrandHeader />
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pb-12 pt-2 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--ink-500)] uppercase">
              Citation Verification
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--ink-950)]">
              案件详情 (Document Detail)
            </h2>
          </div>
          {/* 提供返回聊天的路径 */}
          <Link
            className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--ink-700)] transition-colors hover:border-[var(--brand-500)] hover:text-[var(--brand-700)]"
            href="/"
          >
            返回对话
          </Link>
        </div>

        {/* 加载状态 */}
        {isLoading ? (
          <div className="glass-panel flex min-h-[320px] items-center justify-center rounded-[32px]">
            <div className="flex items-center gap-3">
              <CircularProgress size={20} thickness={4.5} />
              <p className="text-[14px] text-[var(--ink-700)]">
                正在加载案例元数据和段落阅读器...
              </p>
            </div>
          </div>
        ) : null}

        {/* 错误提示 */}
        {error ? (
          <Alert
            severity="error"
            sx={{
              borderRadius: "20px",
              backgroundColor: "rgba(255,255,255,0.72)",
              border: "1px solid var(--line-soft)",
            }}
          >
            {error}
          </Alert>
        ) : null}

        {/* 文档详情主体 */}
        {!isLoading && currentDocument ? (
          <>
            <CaseMetadata document={currentDocument} />
            <ParagraphList focusRange={focusRange} paragraphs={paragraphs} />
          </>
        ) : null}
      </section>
    </main>
  );
}
