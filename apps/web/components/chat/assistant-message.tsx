/**
 * 助手消息组件 (AssistantMessage)
 * 
 * 核心职责：
 * 渲染 RAG 系统返回的 AI 回答、引用的法律案例 (authorities)、
 * 支持段落 (supporting excerpts) 和局限性提示 (limitations)。
 * 
 * 遵循 Trust through evidence (基于证据的信任) 原则：
 * 将生成的回答与引用的原文档无缝结合展示。
 */
"use client";

import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type { ComponentProps } from "react";

import type { AssistantChatMessage } from "@/store/chat-store";

import { AuthorityCard } from "./authority-card";
import { EvidenceSection } from "./evidence-section";

type AssistantMessageProps = {
  // 助手消息数据对象
  message: AssistantChatMessage;
  // 点击引用卡片时的回调函数
  onSelectAuthority: NonNullable<
    ComponentProps<typeof AuthorityCard>["onSelect"]
  >;
};

export function AssistantMessage({
  message,
  onSelectAuthority,
}: AssistantMessageProps) {
  // 加载状态 UI：当还在检索证据和生成回答时显示
  if (message.loading) {
    return (
      <article className="paper-panel flex max-w-3xl items-center gap-3 rounded-[28px] rounded-tl-md px-5 py-4">
        <CircularProgress size={18} thickness={4.5} />
        <div>
          <p className="text-[14px] font-semibold text-[var(--ink-950)]">
            正在检索法律权威
          </p>
          <p className="text-[13px] text-[var(--ink-500)]">
            检索有依据的证据，准备基于引用的回答。
          </p>
        </div>
      </article>
    );
  }

  // 没有响应数据则不渲染
  if (!message.response) {
    return null;
  }

  return (
    <article className="glass-panel max-w-3xl rounded-[30px] rounded-tl-md px-5 py-5 sm:px-6">
      <div className="space-y-5">
        {/* 头部信息：显示 AI 身份与查询类型 */}
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

        {/* 核心回答和局限性提示 */}
        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-[var(--ink-950)]">
            {message.response.answerText}
          </p>

          {/* 如果模型由于检索不足或错误产生了 limitations，在此处通过警告框提示用户 */}
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

        {/* 引用的法律权威列表 */}
        {message.response.authorities.length > 0 ? (
          <section className="space-y-3">
            <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--ink-500)] uppercase">
              引用的权威案例 (Cited Authorities)
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

        {/* 支持当前回答的具体原文片段 (Excerpts) */}
        <EvidenceSection excerpts={message.response.supportingExcerpts} />
      </div>
    </article>
  );
}
