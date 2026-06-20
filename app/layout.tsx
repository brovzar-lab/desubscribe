import type { Metadata } from "next";
import Link from "next/link";
import LogoutLink from "@/components/LogoutLink";
import ThemeToggle from "@/components/ThemeToggle";
import { LayoutDashboard, Users, ClipboardCheck, Activity, Settings } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desubscribe — what you pay for, and how to stop",
  description: "Find every subscription across email + bank, see the spend, and let AI cancel.",
};

function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link href={href} className="nav-link" aria-label={label}>
      <Icon className="w-[18px] h-[18px]" />
      <span>{label}</span>
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body>
        {/* ── Top Nav — quiet shell ───────────────────────── */}
        <header className="nav-bar sticky top-0 z-40">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2.5 cursor-pointer" aria-label="Desubscribe home">
              <span className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white" style={{ background: 'var(--accent)' }}>
                D
              </span>
              <span className="font-display text-lg font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
                desubscribe
              </span>
            </Link>

            {/* Center Nav */}
            <nav className="hidden sm:flex items-center gap-1" aria-label="Main navigation">
              <NavLink href="/" icon={LayoutDashboard} label="Dashboard" />
              <NavLink href="/household" icon={Users} label="Household" />
              <NavLink href="/review" icon={ClipboardCheck} label="Review" />
              <NavLink href="/activity" icon={Activity} label="Activity" />
            </nav>

            {/* Right */}
            <div className="flex items-center gap-1">
              <NavLink href="/settings" icon={Settings} label="Settings" />
              <ThemeToggle />
              {process.env.APP_PASSWORD && (
                <LogoutLink />
              )}
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="flex sm:hidden items-center gap-1 px-4 pb-2 overflow-x-auto" aria-label="Mobile navigation">
            <NavLink href="/" icon={LayoutDashboard} label="Dashboard" />
            <NavLink href="/household" icon={Users} label="Household" />
            <NavLink href="/review" icon={ClipboardCheck} label="Review" />
            <NavLink href="/activity" icon={Activity} label="Activity" />
          </nav>
        </header>

        {/* ── Main Content ────────────────────────────────── */}
        <main>
          <div className="mx-auto max-w-6xl px-6 py-8">
            {children}
            <footer className="mt-16 pb-8 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
              Runs locally · data stays in <code style={{ color: 'var(--ink-3)', opacity: 0.7 }}>dev.db</code> · full-auto cancels are audited
            </footer>
          </div>
        </main>
      </body>
    </html>
  );
}
