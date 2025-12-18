"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Home,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Volume2,
  Zap,
} from "lucide-react";

interface SidebarProps {
  guildId: string;
  guildName: string;
}

const navigation = [
  { name: "대시보드", href: "", icon: Home },
  {
    name: "XP 시스템",
    icon: Zap,
    children: [
      { name: "XP 설정", href: "/xp/settings", icon: Settings },
      { name: "레벨 설정", href: "/xp/levels", icon: TrendingUp },
      { name: "XP 핫타임", href: "/xp/hottime", icon: Sparkles },
      { name: "XP 차단", href: "/xp/exclusions", icon: Shield },
      { name: "레벨 보상", href: "/xp/rewards", icon: Trophy },
      { name: "알림 설정", href: "/xp/notifications", icon: Volume2 },
      { name: "통계", href: "/xp/stats", icon: BarChart3 },
    ],
  },
  { name: "멤버 관리", href: "/members", icon: Users },
  { name: "설정", href: "/settings", icon: Settings },
];

export function DashboardSidebar({ guildId, guildName }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${guildId}`;

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`;
    if (href === "") {
      return pathname === basePath;
    }
    return pathname.startsWith(fullPath);
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-700/50 bg-slate-900/50">
      {/* Guild Header */}
      <div className="border-b border-slate-700/50 p-4">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">
          ← 서버 목록
        </Link>
        <h2 className="mt-2 truncate text-lg font-semibold text-white">
          {guildName}
        </h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              {item.children ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400">
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </div>
                  <ul className="ml-4 space-y-1 border-l border-slate-700/50 pl-2">
                    {item.children.map((child) => (
                      <li key={child.name}>
                        <Link
                          href={`${basePath}${child.href}`}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            isActive(child.href)
                              ? "bg-indigo-600 text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <child.icon className="h-4 w-4" />
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Link
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
