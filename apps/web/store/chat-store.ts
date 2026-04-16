"use client";

import type { AskResponse, AuthorityResult } from "shared";
import { create } from "zustand";

import { askLegalQuestion } from "@/lib/api";
import { suggestedPrompts } from "@/lib/mock-data";

export type UserChatMessage = {
  id: string;
  role: "user";
  content: string;
};

export type AssistantChatMessage = {
  id: string;
  role: "assistant";
  response?: AskResponse;
  loading?: boolean;
  error?: string;
};

export type ChatMessage = UserChatMessage | AssistantChatMessage;

type ChatState = {
  currentInput: string;
  messages: ChatMessage[];
  isAsking: boolean;
  askError: string | null;
  selectedAuthority: AuthorityResult | null;
  suggestedPrompts: string[];
  setCurrentInput: (value: string) => void;
  applySuggestedPrompt: (value: string) => void;
  selectAuthority: (authority: AuthorityResult | null) => void;
  submitQuestion: (value?: string) => Promise<void>;
  resetChat: () => void;
};

function createUserMessage(content: string): UserChatMessage {
  return {
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    content,
  };
}

function createLoadingAssistant(): AssistantChatMessage {
  return {
    id: `assistant-loading-${crypto.randomUUID()}`,
    role: "assistant",
    loading: true,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentInput: "",
  messages: [],
  isAsking: false,
  askError: null,
  selectedAuthority: null,
  suggestedPrompts,
  setCurrentInput: (value) => set({ currentInput: value }),
  applySuggestedPrompt: (value) => set({ currentInput: value }),
  selectAuthority: (authority) => set({ selectedAuthority: authority }),
  async submitQuestion(value) {
    const nextQuery = (value ?? get().currentInput).trim();
    if (!nextQuery || get().isAsking) {
      return;
    }

    const userMessage = createUserMessage(nextQuery);
    const loadingMessage = createLoadingAssistant();
    set((state) => ({
      currentInput: "",
      isAsking: true,
      askError: null,
      messages: [...state.messages, userMessage, loadingMessage],
    }));

    try {
      const response = await askLegalQuestion({
        query: nextQuery,
        topK: 5,
        filters: {},
      });

      set((state) => ({
        isAsking: false,
        messages: state.messages.map((message) =>
          message.id === loadingMessage.id
            ? {
                id: response.messageId,
                role: "assistant",
                response,
              }
            : message,
        ),
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "The legal research service is currently unavailable.";

      set((state) => ({
        isAsking: false,
        askError: errorMessage,
        messages: state.messages.map((message) =>
          message.id === loadingMessage.id
            ? {
                id: `assistant-error-${crypto.randomUUID()}`,
                role: "assistant",
                error: errorMessage,
                response: {
                  messageId: `assistant-error-${crypto.randomUUID()}`,
                  role: "assistant",
                  query: nextQuery,
                  normalizedQuery: nextQuery,
                  queryType: "natural_language_query",
                  answerText:
                    "I couldn’t complete this legal research request. Please retry after the API service is available.",
                  authorities: [],
                  supportingExcerpts: [],
                  limitations: [
                    "The backend API request failed before a grounded answer could be generated.",
                  ],
                },
              }
            : message,
        ),
      }));
    }
  },
  resetChat() {
    set({
      currentInput: "",
      messages: [],
      isAsking: false,
      askError: null,
      selectedAuthority: null,
      suggestedPrompts,
    });
  },
}));
