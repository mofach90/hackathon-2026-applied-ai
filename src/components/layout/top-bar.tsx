import { User } from "lucide-react";
import type { Manager } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface TopBarProps {
  manager: Manager;
}

export function TopBar({ manager }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <div />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <User className="h-4 w-4" />
          <span>{manager.name}</span>
        </div>
      </div>
    </header>
  );
}
