export function BrandHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pb-8 pt-6 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="brand-orb flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-soft)] bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--brand-700)] shadow-[var(--shadow-soft)]">
          CB
        </div>
        <div className="space-y-0.5">
          <p className="text-[14px] font-semibold text-[var(--ink-950)]">
            CaseBase AI
          </p>
          <p className="text-[11px] tracking-[0.16em] text-[var(--ink-500)] uppercase">
            Research Assistant
          </p>
        </div>
      </div>
      <p className="hidden max-w-xs text-right text-[12px] leading-5 text-[var(--ink-500)] md:block">
        Retrieval-first legal research with grounded authorities and
        paragraph-level evidence.
      </p>
    </header>
  );
}
