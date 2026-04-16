"use client";

import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type { ComponentProps } from "react";

import type { AssistantChatMessage } from "@/store/chat-store";

import { AuthorityCard } from "./authority-card";
import { EvidenceSection } from "./evidence-section";

type AssistantMessageProps = {
  message: AssistantChatMessage;
  onSelectAuthority: NonNullable<
    ComponentProps<typeof AuthorityCard>["onSelect"]
  >;
};

export function AssistantMessage({
  message,
  onSelectAuthority,
}: AssistantMessageProps) {
  if (message.loading) {
    return (
      <article className="paper-panel flex max-w-3xl items-center gap-3 rounded-[28px] rounded-tl-md px-5 py-4">
        <CircularProgress size={18} thickness={4.5} />
        <div>
          <p className="text-[14px] font-semibold text-[var(--ink-950)]">
            Researching authorities
          </p>
          <p className="text-[13px] text-[var(--ink-500)]">
            Retrieving grounded evidence and preparing a citation-backed answer.
          </p>
        </div>
      </article>
    );
  }

  if (!message.response) {
    return null;
  }

  return (
    <article className="glass-panel max-w-3xl rounded-[30px] rounded-tl-md px-5 py-5 sm:px-6">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-[11px] font-semibold tracking-[0.18em] text-[var(--brand-700)] uppercase">
            AI
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--ink-950)]">
              CaseBase AI
            </p>
            <p className="font-mono text-[11px] text-[var(--ink-500)]">
              {message.response.queryType}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-[var(--ink-950)]">
            {message.response.answerText}
          </p>

          {message.response.limitations.length > 0 ? (
            <Alert
              severity={message.error ? "error" : "warning"}
              sx={{
                borderRadius: "16px",
                border: "1px solid var(--line-soft)",
                backgroundColor: "rgba(255,255,255,0.65)",
              }}
            >
              <ul className="list-disc space-y-1 pl-4 text-[13px] leading-6">
                {message.response.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </div>

        {message.response.authorities.length > 0 ? (
          <section className="space-y-3">
            <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--ink-500)] uppercase">
              Cited Authorities
            </p>
            <div className="grid gap-3">
              {message.response.authorities.map((authority) => (
                <AuthorityCard
                  authority={authority}
                  key={authority.chunkId}
                  onSelect={onSelectAuthority}
                />
              ))}
            </div>
          </section>
        ) : null}

        <EvidenceSection excerpts={message.response.supportingExcerpts} />
      </div>
    </article>
  );
}
