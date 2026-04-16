"use client";

import { useEffect, useRef } from "react";

import type { AuthorityResult } from "shared";

import type { ChatMessage } from "@/store/chat-store";

import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

type ConversationThreadProps = {
  messages: ChatMessage[];
  onSelectAuthority: (authority: AuthorityResult) => void;
};

export function ConversationThread({
  messages,
  onSelectAuthority,
}: ConversationThreadProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  });

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-5 pb-44 pt-4 sm:px-8">
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
      <div ref={endRef} />
    </section>
  );
}
