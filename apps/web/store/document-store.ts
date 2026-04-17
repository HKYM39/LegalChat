/**
 * 法律文档状态管理 (Zustand Document Store)
 * 
 * 职责：
 * 1. 管理当前查看的法律文档（判例）元数据。
 * 2. 加载并存储文档的所有段落内容，支撑“段落阅读器”功能。
 * 3. 管理文档内的关注范围（Focus Range），实现从聊天引用跳转后的自动定位与高亮。
 * 
 * 该 Store 主要服务于 Case Detail Page (案件详情页)。
 */
"use client";

import type { DocumentResponse, ParagraphRecord } from "shared";
import { create } from "zustand";

import { getDocument, getDocumentParagraphs } from "@/lib/api";

/**
 * 关注的段落范围定义
 */
type FocusRange = {
  // 起始段落编号
  start: number | null;
  // 结束段落编号
  end: number | null;
};

/**
 * 文档 Store 的状态与操作定义
 */
type DocumentState = {
  // 当前文档元数据（标题、引用号、法院等）
  currentDocument: DocumentResponse | null;
  // 文档包含的所有段落列表
  paragraphs: ParagraphRecord[];
  // 加载状态指示
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 当前高亮的段落范围（由聊天跳转而来）
  focusRange: FocusRange | null;
  
  // 根据 ID 加载文档及其段落数据
  loadDocument: (documentId: string) => Promise<void>;
  // 手动设置关注的段落范围
  setFocusRange: (focusRange: FocusRange | null) => void;
  // 重置 Store 状态（离开详情页时调用）
  reset: () => void;
};

/**
 * 文档 Store 实现
 */
export const useDocumentStore = create<DocumentState>((set) => ({
  currentDocument: null,
  paragraphs: [],
  isLoading: false,
  error: null,
  focusRange: null,

  /**
   * 加载法律文档详情及其段落
   * 并行调用两个接口以优化性能
   */
  async loadDocument(documentId) {
    set({
      isLoading: true,
      error: null,
    });

    try {
      // 并行获取文档元数据和全量段落
      const [document, paragraphResponse] = await Promise.all([
        getDocument(documentId),
        getDocumentParagraphs(documentId),
      ]);

      set({
        currentDocument: document,
        paragraphs: paragraphResponse.paragraphs,
        isLoading: false,
      });
    } catch (error) {
      set({
        currentDocument: null,
        paragraphs: [],
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "无法加载该法律权威详情，请稍后重试。",
      });
    }
  },

  /**
   * 设置段落关注范围
   * 用于在 UI 中高亮显示特定引用的段落
   */
  setFocusRange(focusRange) {
    set({ focusRange });
  },

  /**
   * 清空状态，防止组件卸载后残留数据
   */
  reset() {
    set({
      currentDocument: null,
      paragraphs: [],
      isLoading: false,
      error: null,
      focusRange: null,
    });
  },
}));
