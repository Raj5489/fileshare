"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Ticket,
  BookOpen,
  Settings,
  BarChart3,
  UploadCloud,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowser } from "@/lib/supabase";

const NAV = [
  { href: "/admin/assistant", label: "Overview", icon: LayoutDashboard },
  {
    href: "/admin/assistant/conversations",
    label: "Conversations",
    icon: MessageSquare,
  },
  { href: "/admin/assistant/tickets", label: "Tickets", icon: Ticket },
  {
    href: "/admin/assistant/knowledge",
    label: "Knowledge Base",
    icon: BookOpen,
  },
  { href: "/admin/assistant/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/assistant/settings", label: "Settings", icon: Settings },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground font-medium shadow-sm shadow-primary/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    return href === "/admin/assistant"
      ? pathname === "/admin/assistant"
      : pathname.startsWith(href);
  }

  async function handleLogout() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card sm:flex sm:flex-col">
        {/* Brand */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <UploadCloud className="h-3.5 w-3.5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold leading-none">
              <span className="gradient-text">FileShare</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Support Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV.map(({ href, label, icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={isActive(href)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3 flex flex-col gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <UploadCloud className="h-4 w-4 shrink-0" />
            Back to site
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive text-left w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur-xl sm:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <UploadCloud className="h-3 w-3" />
            </div>
            <span className="text-sm font-semibold gradient-text">
              FileShare Admin
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card sm:hidden">
          {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors",
                isActive(href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{label.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
