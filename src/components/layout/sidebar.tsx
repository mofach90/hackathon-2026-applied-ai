import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [{ href: "/", label: "Dashboard", icon: LayoutDashboard }];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">RentPilot AI</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
