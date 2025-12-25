"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NavigationLink } from "@/components/navigation-link";
import { Icon } from "@iconify/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SidebarProps {
  guildId: string;
  guildName: string;
  guildIcon?: string | null;
}

function getGuildIconUrl(guildId: string, icon: string | null | undefined) {
  if (!icon) return null;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
}

const navigation = [
  {
    name: "대시보드",
    href: "",
    icon: "solar:home-2-linear",
    iconActive: "solar:home-2-bold",
  },
  {
    name: "XP 시스템",
    icon: "solar:bolt-linear",
    iconActive: "solar:bolt-bold",
    children: [
      { name: "XP 설정", href: "/xp/settings", icon: "solar:settings-linear", iconActive: "solar:settings-bold" },
      { name: "XP 규칙", href: "/xp/rules", icon: "solar:book-linear", iconActive: "solar:book-bold" },
      { name: "레벨 보상", href: "/xp/rewards", icon: "solar:cup-star-linear", iconActive: "solar:cup-star-bold" },
      { name: "알림 설정", href: "/xp/notifications", icon: "solar:bell-linear", iconActive: "solar:bell-bold" },
      { name: "통계", href: "/xp/stats", icon: "solar:chart-2-linear", iconActive: "solar:chart-2-bold" },
    ],
  },
  {
    name: "화폐 시스템",
    icon: "solar:wallet-linear",
    iconActive: "solar:wallet-bold",
    children: [
      { name: "화폐 설정", href: "/currency/settings", icon: "solar:settings-linear", iconActive: "solar:settings-bold" },
      { name: "화폐 규칙", href: "/currency/rules", icon: "solar:book-linear", iconActive: "solar:book-bold" },
      { name: "상점", href: "/currency/shop", icon: "solar:shop-linear", iconActive: "solar:shop-bold" },
      { name: "장터", href: "/market", icon: "solar:bag-4-linear", iconActive: "solar:bag-4-bold" },
      { name: "지갑 관리", href: "/currency/wallets", icon: "solar:card-linear", iconActive: "solar:card-bold" },
      { name: "거래 기록", href: "/currency/transactions", icon: "solar:document-text-linear", iconActive: "solar:document-text-bold" },
    ],
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

export function DashboardSidebar({ guildId, guildName, guildIcon }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${guildId}`;

  // 토글 상태 관리 (카테고리 이름을 키로 사용)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`;
    if (href === "") {
      return pathname === basePath;
    }
    return pathname.startsWith(fullPath);
  };

  const isParentActive = (children: typeof navigation[1]["children"]) => {
    return children?.some(child => isActive(child.href));
  };


  const toggleCategory = (name: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const isCategoryOpen = (name: string) => {
    // 명시적으로 설정된 값이 있으면 그 값 사용, 없으면 false
    return openCategories[name] ?? false;
  };

  // 접힌 상태에서 활성화된 항목만 필터링
  const getVisibleChildren = (name: string, children: NonNullable<typeof navigation[1]["children"]>) => {
    if (isCategoryOpen(name)) {
      return children; // 펼쳐진 상태면 전체 표시
    }
    // 접힌 상태면 활성화된 항목만 표시
    return children.filter(child => isActive(child.href));
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
              {item.children ? (
                <div className="space-y-1">
                  <button
                    onClick={() => toggleCategory(item.name)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors",
                      isParentActive(item.children)
                        ? "text-white bg-white/5"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        icon={isParentActive(item.children) ? item.iconActive : item.icon}
                        className="h-5 w-5"
                      />
                      {item.name}
                    </div>
                    <Icon
                      icon="solar:alt-arrow-down-linear"
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isCategoryOpen(item.name) ? "rotate-180" : ""
                      )}
                    />
                  </button>
                  {/* 하위 항목 목록 */}
                  {(() => {
                    const visibleChildren = getVisibleChildren(item.name, item.children);
                    if (visibleChildren.length === 0) return null;
                    return (
                      <ul className="ml-4 space-y-0.5 pl-4 border-l border-white/10">
                        {visibleChildren.map((child) => (
                          <li key={child.name}>
                            <NavigationLink
                              href={`${basePath}${child.href}`}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all",
                                isActive(child.href)
                                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white font-medium border border-indigo-500/30"
                                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
                              )}
                            >
                              <Icon
                                icon={isActive(child.href) ? child.iconActive : child.icon}
                                className="h-4 w-4"
                              />
                              {child.name}
                            </NavigationLink>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              ) : (
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
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Icon icon="solar:crown-bold" className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white">Topia Empire</p>
            <p className="text-[10px] text-white/40">v1.0.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
