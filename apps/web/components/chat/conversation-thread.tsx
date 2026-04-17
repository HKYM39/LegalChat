/**
 * 对话线程组件 (ConversationThread)
 * 
 * 职责：
 * 负责渲染整个对话流（Chat stream），包括用户消息和系统（Assistant）消息。
 * 当新消息加入时，自动滚动到对话底部，提供自然、连续的聊天体验。
 */
"use client";

import { useEffect, useRef } from "react";

import type { AuthorityResult } from "shared";

import type { ChatMessage } from "@/store/chat-store";

import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

type ConversationThreadProps = {
  // 当前的所有对话消息列表
  messages: ChatMessage[];
  // 当用户点击某条 Authority 时的处理函数
  onSelectAuthority: (authority: AuthorityResult) => void;
};

export function ConversationThread({
  messages,
  onSelectAuthority,
}: ConversationThreadProps) {
  // 引用底部 DOM 节点以实现自动滚动
  const endRef = useRef<HTMLDivElement | null>(null);

  // 每次渲染后自动滚动到对话底部
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  });

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-5 pb-44 pt-4 sm:px-8">
      {/* 遍历渲染消息：区分 User 和 Assistant 的 UI 呈现 */}
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage content={message.content} key={message.id} />
        ) : (
          <AssistantMessage
            key={message.id}
            message={message}
            onSelectAuthority={onSelectAuthority}
          />
        ),
      )}
      {/* 底部锚点，用于 scrollIntoView 定位 */}
      <div ref={endRef} />
    </section>
  );
}
