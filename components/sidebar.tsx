"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◻" },
  { href: "/clients", label: "Cliënten", icon: "◌" },
  { href: "/dossiers", label: "Dossiers", icon: "▣" },
  { href: "/tasks", label: "Taken", icon: "✓" },
  { href: "/time-tracking", label: "Tijdregistratie", icon: "◷" },
  { href: "/documents", label: "Documenten", icon: "▤" }
];

function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2f7cff]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v16" />
      <path d="M5 8h14" />
      <path d="M3 20h18" />
      <path d="M7 8l-3 6h6l-3-6Z" />
      <path d="M17 8l-3 6h6l-3-6Z" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-[300px] flex-col border-r border-slate-700 bg-[#1c2942] text-slate-200 lg:flex">
      <div className="px-5 pb-5 pt-7">
        <div className="flex items-center gap-3">
          <ScaleIcon />
          <div>
            <p className="text-4xl font-extrabold leading-none text-white">LegalDesk</p>
            <p className="mt-1 text-sm text-slate-400">Advocatenbeheer</p>
          </div>
        </div>

        <div className="mt-7 rounded-xl border border-slate-600 bg-slate-700/40 px-3 py-2.5">
          <form action="/search" method="get" className="flex items-center justify-between gap-2 text-slate-400">
            <input
              name="q"
              placeholder="Zoeken..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <button type="submit" className="rounded bg-slate-600 px-2 py-0.5 text-xs text-slate-300">
              ⌘K
            </button>
          </form>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-xl px-4 py-3 text-xl font-semibold transition ${
                  active ? "bg-[#2b49ba] text-white" : "text-slate-200 hover:bg-slate-700/60"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="ml-3">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <p className="mt-8 px-2 text-sm font-bold tracking-[0.12em] text-slate-500 uppercase">Snelle acties</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/clients?new=1" className="rounded-xl border border-slate-600 bg-slate-700/30 px-3 py-2.5 text-center text-sm font-medium hover:bg-slate-700/60">
            + Cliënt
          </Link>
          <Link href="/dossiers?new=1" className="rounded-xl border border-slate-600 bg-slate-700/30 px-3 py-2.5 text-center text-sm font-medium hover:bg-slate-700/60">
            + Dossier
          </Link>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-700 px-5 py-6">
        <Link href="/api/auth/logout" className="text-base font-medium text-slate-300 hover:text-white">
          Uitloggen
        </Link>
        <p className="mt-4 text-base text-slate-500">LegalDesk v1.0</p>
      </div>
    </aside>
  );
}
