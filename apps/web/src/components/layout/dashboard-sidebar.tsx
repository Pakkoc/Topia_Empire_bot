"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { NavigationLink } from "@/components/navigation-link";
import { Icon } from "@iconify/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarHeatmap } from "@/components/charts/sidebar-heatmap";
import { useActivityHeatmap } from "@/hooks/queries/use-activity-heatmap";

interface SidebarProps {
  guildId: string;
  guildName: string;
  guildIcon?: string | null;
}

function getGuildIconUrl(guildId: string, icon: string | null | undefined) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

function createNavigation() {
  return [
    {
      name: "대시보드",
      href: "",
      icon: "solar:home-2-linear",
      iconActive: "solar:home-2-bold",
    },
    {
      name: "통계",
      href: "/stats",
      icon: "solar:chart-2-linear",
      iconActive: "solar:chart-2-bold",
    },
    {
      name: "멤버 관리",
      href: "/members",
      icon: "solar:users-group-rounded-linear",
      iconActive: "solar:users-group-rounded-bold",
    },
    {
      name: "설정",
      href: "/settings",
      icon: "solar:settings-linear",
      iconActive: "solar:settings-bold",
    },
  ];
}

export function DashboardSidebar({ guildId, guildName, guildIcon }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${guildId}`;

  // 네비게이션 생성
  const navigation = useMemo(() => createNavigation(), []);

  // 활동 히트맵 데이터
  const { data: heatmapData, isLoading: isHeatmapLoading } = useActivityHeatmap(guildId);

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`;
    if (href === "") {
      return pathname === basePath;
    }
    return pathname.startsWith(fullPath);
  };

  return (
    <aside className="flex h-full w-72 flex-col bg-black/40 backdrop-blur-xl border-r border-white/5">
      {/* Guild Header */}
      <div className="p-5 border-b border-white/5">
        <NavigationLink
          href="/dashboard"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors mb-4"
        >
          <Icon icon="solar:arrow-left-linear" className="w-4 h-4" />
          서버 목록
        </NavigationLink>

        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 rounded-xl">
            <AvatarImage src={getGuildIconUrl(guildId, guildIcon) ?? undefined} />
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold">
              {guildName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-base font-semibold text-white">
              {guildName}
            </h2>
            <p className="text-xs text-white/40">서버 관리</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavigationLink
                href={`${basePath}${item.href}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all",
                  isActive(item.href)
                    ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white font-medium border border-indigo-500/30"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                )}
              >
                <Icon
                  icon={isActive(item.href) ? item.iconActive : item.icon}
                  className="h-5 w-5"
                />
                {item.name}
              </NavigationLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Activity Heatmap */}
      <div className="px-4 py-3 border-t border-white/5">
        <SidebarHeatmap
          cells={heatmapData?.cells ?? []}
          maxCount={heatmapData?.maxCount ?? 0}
          isLoading={isHeatmapLoading}
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <Image src="/logo/main.png" alt="Nexus" width={100} height={32} className="h-8 w-auto" />
        </div>
      </div>
    </aside>
  );
}
