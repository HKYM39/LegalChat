import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaseBase AI",
  description:
    "Chat-first legal research assistant grounded in real authorities, citations, and paragraph-level evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--surface-0)] text-[var(--ink-950)]">
        {children}
      </body>
    </html>
  );
}
