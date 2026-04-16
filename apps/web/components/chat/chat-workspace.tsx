"use client";

import { useChatStore } from "@/store/chat-store";
import { BrandHeader } from "./brand-header";
import { ChatComposer } from "./chat-composer";
import { ConversationThread } from "./conversation-thread";
import { EmptyState } from "./empty-state";

export function ChatWorkspace() {
  const currentInput = useChatStore((state) => state.currentInput);
  const messages = useChatStore((state) => state.messages);
  const isAsking = useChatStore((state) => state.isAsking);
  const askError = useChatStore((state) => state.askError);
  const prompts = useChatStore((state) => state.suggestedPrompts);
  const setCurrentInput = useChatStore((state) => state.setCurrentInput);
  const applySuggestedPrompt = useChatStore(
    (state) => state.applySuggestedPrompt,
  );
  const submitQuestion = useChatStore((state) => state.submitQuestion);
  const selectAuthority = useChatStore((state) => state.selectAuthority);

  const hasMessages = messages.length > 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
      <BrandHeader />
      {hasMessages ? (
        <ConversationThread
          messages={messages}
          onSelectAuthority={selectAuthority}
        />
      ) : (
        <EmptyState onSelectPrompt={applySuggestedPrompt} prompts={prompts} />
      )}
      <ChatComposer
        error={askError}
        isSubmitting={isAsking}
        onChange={setCurrentInput}
        onSubmit={() => submitQuestion()}
        value={currentInput}
      />
    </main>
  );
}
