type UserMessageProps = {
  content: string;
};

export function UserMessage({ content }: UserMessageProps) {
  return (
    <article className="flex justify-end">
      <div className="max-w-[85%] rounded-[26px] rounded-br-md bg-[var(--ink-950)] px-5 py-4 text-[15px] leading-7 text-white shadow-[var(--shadow-soft)] sm:max-w-[72%]">
        {content}
      </div>
    </article>
  );
}
