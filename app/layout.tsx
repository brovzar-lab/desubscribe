import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desubscribe — what you pay for, and how to stop",
  description: "Find every subscription across email + bank, see the spend, and let AI cancel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-5 py-6">
          <header className="mb-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">
                de<span className="text-brand">subscribe</span>
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-white">Dashboard</Link>
              <Link href="/activity" className="hover:text-white">Activity</Link>
              <Link href="/settings" className="hover:text-white">Settings</Link>
            </nav>
          </header>
          {children}
          <footer className="mt-12 text-center text-xs text-muted">
            Runs locally · data stays in <code>dev.db</code> · full-auto cancels are audited
          </footer>
        </div>
      </body>
    </html>
  );
}
