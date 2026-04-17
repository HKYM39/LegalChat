/**
 * 底部聊天输入框组件 (ChatComposer)
 * 
 * 核心职责：
 * 接收用户的自然语言提问，支持换行，并通过回车或点击按钮提交问题以触发法律检索和 AI 回答。
 * 同时处理限流状态与错误提示。
 */
"use client";

import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";

type ChatComposerProps = {
  // 当前输入框的值
  value: string;
  // 是否正在提交中（此时禁用输入和按钮）
  isSubmitting: boolean;
  // 是否受到频率限制
  isRateLimited: boolean;
  // 错误信息提示
  error: string | null;
  // 输入值变化回调
  onChange: (value: string) => void;
  // 提交问题回调
  onSubmit: () => void;
};

export function ChatComposer({
  value,
  isSubmitting,
  isRateLimited,
  error,
  onChange,
  onSubmit,
}: ChatComposerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3">
        {/* 全局错误或限流警告展示 */}
        {error ? (
          <Alert
            severity="error"
            sx={{
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.82)",
              border: "1px solid var(--line-soft)",
            }}
          >
            {error}
          </Alert>
        ) : null}

        <div className="glass-panel rounded-[28px] px-3 py-3 sm:px-4">
          <div className="flex items-end gap-3">
            <TextField
              fullWidth
              multiline
              maxRows={6}
              minRows={1}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                // 回车键直接提交，Shift + 回车进行换行
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="提出法律研究问题 (Ask a legal research question...)"
              slotProps={{
                input: {
                  sx: {
                    padding: 0,
                    alignItems: "flex-start",
                    fontSize: "15px",
                    lineHeight: 1.7,
                    color: "var(--ink-950)",
                  },
                },
                htmlInput: {
                  "aria-label": "提出法律研究问题",
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  alignItems: "flex-start",
                  borderRadius: "18px",
                  backgroundColor: "transparent",
                  padding: "8px 10px",
                  "& fieldset": { border: "none" },
                },
              }}
              value={value}
            />
            {/* 提交按钮 */}
            <IconButton
              color="primary"
              disabled={isSubmitting || isRateLimited || value.trim().length === 0}
              onClick={onSubmit}
              sx={{
                width: 44,
                height: 44,
                backgroundColor: "var(--brand-600)",
                color: "white",
                "&:hover": {
                  backgroundColor: "var(--brand-700)",
                },
                "&.Mui-disabled": {
                  backgroundColor: "rgba(134, 146, 168, 0.35)",
                  color: "rgba(255, 255, 255, 0.72)",
                },
              }}
            >
              <span className="text-lg leading-none">↑</span>
            </IconButton>
          </div>
          {/* 免责声明提示 */}
          <p className="px-2 pt-2 text-center text-[11px] text-[var(--ink-500)]">
            CaseBase AI 可能会返回不完整的研究结果。请始终核实引用的权威案例。
          </p>
        </div>
      </div>
    </div>
  );
}
