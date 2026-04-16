"use client";

import type { DocumentResponse, ParagraphRecord } from "shared";
import { create } from "zustand";

import { getDocument, getDocumentParagraphs } from "@/lib/api";

type FocusRange = {
  start: number | null;
  end: number | null;
};

type DocumentState = {
  currentDocument: DocumentResponse | null;
  paragraphs: ParagraphRecord[];
  isLoading: boolean;
  error: string | null;
  focusRange: FocusRange | null;
  loadDocument: (documentId: string) => Promise<void>;
  setFocusRange: (focusRange: FocusRange | null) => void;
  reset: () => void;
};

export const useDocumentStore = create<DocumentState>((set) => ({
  currentDocument: null,
  paragraphs: [],
  isLoading: false,
  error: null,
  focusRange: null,
  async loadDocument(documentId) {
    set({
      isLoading: true,
      error: null,
    });

    try {
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
            : "Unable to load this authority right now.",
      });
    }
  },
  setFocusRange(focusRange) {
    set({ focusRange });
  },
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
