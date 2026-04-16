"use client";

import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";

type ChatComposerProps = {
  value: string;
  isSubmitting: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatComposer({
  value,
  isSubmitting,
  error,
  onChange,
  onSubmit,
}: ChatComposerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3">
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
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Ask a legal research question..."
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
                  "aria-label": "Ask a legal research question",
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
            <IconButton
              color="primary"
              disabled={isSubmitting || value.trim().length === 0}
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
          <p className="px-2 pt-2 text-center text-[11px] text-[var(--ink-500)]">
            CaseBase AI may surface incomplete research. Always verify the cited
            authorities.
          </p>
        </div>
      </div>
    </div>
  );
}
