/**
 * 前端聊天状态管理 (Zustand Chat Store)
 * 
 * 负责管理对话历史、用户输入、加载状态、API 调用以及频率限制逻辑。
 */
"use client";

import type {
  AskResponse,
  AuthorityResult,
  ChatRateLimitDetails,
  InputSecurityViolation,
} from "shared";
import { validateUserInputSecurity } from "shared";
import { create } from "zustand";

import {
  askLegalQuestion,
  ApiError,
  isChatRateLimitDetails,
  isInputSecurityErrorDetails,
} from "@/lib/api";
import {
  consumeChatRateLimit,
  createChatRateLimitMessage,
  isChatRateLimitCode,
} from "@/lib/chat-rate-limit";
import { suggestedPrompts } from "@/lib/mock-data";

/**
 * 用户消息类型定义
 */
export type UserChatMessage = {
  id: string;
  role: "user";
  content: string;
};

/**
 * 助手消息类型定义，支持加载中和错误状态
 */
export type AssistantChatMessage = {
  id: string;
  role: "assistant";
  response?: AskResponse;
  loading?: boolean;
  error?: string;
};

export type ChatMessage = UserChatMessage | AssistantChatMessage;

/**
 * 聊天 Store 的状态与操作定义
 */
type ChatState = {
  // 当前输入框内容
  currentInput: string;
  // 对话流消息列表
  messages: ChatMessage[];
  // 是否正在请求 API
  isAsking: boolean;
  // 最近一次请求错误（如有）
  askError: string | null;
  // 最近一次输入安全拒绝详情
  inputSecurityViolation: InputSecurityViolation | null;
  // 频率限制详情
  rateLimit: ChatRateLimitDetails | null;
  // 当前选中的法律权威信息（用于侧边栏或详情页展示）
  selectedAuthority: AuthorityResult | null;
  // 推荐提示词列表
  suggestedPrompts: string[];
  
  // 设置当前输入内容
  setCurrentInput: (value: string) => void;
  // 应用推荐提示词到输入框
  applySuggestedPrompt: (value: string) => void;
  // 选择法律权威进行展示
  selectAuthority: (authority: AuthorityResult | null) => void;
  // 提交法律问题
  submitQuestion: (value?: string) => Promise<void>;
  // 重置对话状态
  resetChat: () => void;
};

/**
 * 创建内部工具函数：构建用户消息
 */
function createUserMessage(content: string): UserChatMessage {
  return {
    id: `user-${crypto.randomUUID()}`,
    role: "user",
    content,
  };
}

/**
 * 创建内部工具函数：构建加载中状态的助手占位消息
 */
function createLoadingAssistant(): AssistantChatMessage {
  return {
    id: `assistant-loading-${crypto.randomUUID()}`,
    role: "assistant",
    loading: true,
  };
}

/**
 * 主 Chat Store 实现
 */
export const useChatStore = create<ChatState>((set, get) => ({
  currentInput: "",
  messages: [],
  isAsking: false,
  askError: null,
  inputSecurityViolation: null,
  rateLimit: null,
  selectedAuthority: null,
  suggestedPrompts,
  setCurrentInput: (value) => set({ currentInput: value }),
  applySuggestedPrompt: (value) => set({ currentInput: value }),
  selectAuthority: (authority) => set({ selectedAuthority: authority }),
  
  /**
   * 提交法律问题的主要逻辑
   * 
   * 包含：频率限制检查 -> 本地 UI 状态更新 -> API 调用 -> 处理结果/错误
   */
  async submitQuestion(value) {
    const rawQuery = value ?? get().currentInput;
    if (get().isAsking) {
      return;
    }

    const inputSecurity = validateUserInputSecurity(rawQuery);
    if (!inputSecurity.allowed) {
      set({
        askError: inputSecurity.violation.message,
        inputSecurityViolation: inputSecurity.violation,
        rateLimit: null,
      });
      return;
    }

    const nextQuery = inputSecurity.normalizedInput;

    // 1. 客户端频率限制检查
    const localRateLimit = consumeChatRateLimit();
    if (!localRateLimit.allowed) {
      const rateLimitMessage = createChatRateLimitMessage(localRateLimit.details);
      set({
        askError: rateLimitMessage,
        inputSecurityViolation: null,
        rateLimit: localRateLimit.details,
      });
      return;
    }

    // 2. 更新 UI 为加载中状态，清空输入框
    const userMessage = createUserMessage(nextQuery);
    const loadingMessage = createLoadingAssistant();
    set((state) => ({
      currentInput: "",
      isAsking: true,
      askError: null,
      inputSecurityViolation: null,
      rateLimit: null,
      messages: [...state.messages, userMessage, loadingMessage],
    }));

    try {
      // 3. 调用 Hono /ask 接口进行 RAG 检索与生成
      const response = await askLegalQuestion({
        query: nextQuery,
        topK: 5,
        filters: {},
        conversationId: localRateLimit.clientId,
      });

      // 4. 请求成功：将加载中消息替换为真实的助手回答
      set((state) => ({
        isAsking: false,
        askError: null,
        inputSecurityViolation: null,
        rateLimit: null,
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
      // 5. 请求失败：处理 API 错误、频率限制等异常
      const errorMessage =
        error instanceof Error
          ? error.message
          : "The legal research service is currently unavailable.";
      
      const rateLimitDetails =
        error instanceof ApiError &&
        isChatRateLimitCode(error.code) &&
        isChatRateLimitDetails(error.details)
          ? error.details
          : null;
      const inputSecurityViolation =
        error instanceof ApiError && isInputSecurityErrorDetails(error.details)
          ? error.details
          : null;
      
      const resolvedErrorMessage = inputSecurityViolation
        ? inputSecurityViolation.message
        : rateLimitDetails
          ? createChatRateLimitMessage(rateLimitDetails)
          : errorMessage;

      set((state) => ({
        isAsking: false,
        askError: resolvedErrorMessage,
        inputSecurityViolation,
        rateLimit: rateLimitDetails,
        messages: state.messages.map((message) =>
          message.id === loadingMessage.id
            ? {
                id: `assistant-error-${crypto.randomUUID()}`,
                role: "assistant",
                error: resolvedErrorMessage,
                response: {
                  messageId: `assistant-error-${crypto.randomUUID()}`,
                  role: "assistant",
                  query: nextQuery,
                  normalizedQuery: nextQuery,
                  queryType: "natural_language_query",
                  answerText: inputSecurityViolation
                    ? "该输入已被安全策略拦截，未进入法律检索与模型生成流程。"
                    : rateLimitDetails
                    ? "This chat request hit the current message limit before research could run."
                    : "I couldn’t complete this legal research request. Please retry after the API service is available.",
                  authorities: [],
                  supportingExcerpts: [],
                  limitations: inputSecurityViolation
                    ? [resolvedErrorMessage]
                    : rateLimitDetails
                      ? [resolvedErrorMessage]
                      : [
                          "The backend API request failed before a grounded answer could be generated.",
                        ],
                },
              }
            : message,
        ),
      }));
    }
  },
  
  /**
   * 重置所有状态，开始新对话
   */
  resetChat() {
    set({
      currentInput: "",
      messages: [],
      isAsking: false,
      askError: null,
      inputSecurityViolation: null,
      rateLimit: null,
      selectedAuthority: null,
      suggestedPrompts,
    });
  },
}));
