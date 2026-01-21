"use client";

import { useParams } from "next/navigation";
import { useGuilds, useGuildStats } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { DiscordIcon } from "@/components/icons/discord-icon";
import { getBotInviteUrl } from "@/lib/discord";

export default function GuildDashboardPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { data: guilds, isLoading: guildsLoading } = useGuilds();
  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);

  const guild = guilds?.find((g) => g.id === guildId);
  const isLoading = guildsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
              <div className="h-4 w-24 rounded bg-white/10 mb-3" />
              <div className="h-8 w-16 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    {
      label: "총 멤버",
      value: stats?.totalMembers.toLocaleString() ?? "0",
      subValue: stats?.membersWithXp ? `XP 보유: ${stats.membersWithXp.toLocaleString()}명` : undefined,
      icon: "solar:users-group-rounded-linear",
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "오늘 텍스트 활동",
      value: stats?.todayTextActive.toLocaleString() ?? "0",
      subValue: "명",
      icon: "solar:chat-line-linear",
      color: "from-green-500 to-emerald-500",
    },
    {
      label: "오늘 음성 활동",
      value: stats?.todayVoiceActive.toLocaleString() ?? "0",
      subValue: "명",
      icon: "solar:microphone-linear",
      color: "from-purple-500 to-pink-500",
    },
    {
      label: "XP 시스템",
      value: stats?.xpEnabled ? "활성" : "비활성",
      isStatus: true,
      isActive: stats?.xpEnabled,
      icon: "solar:bolt-linear",
      color: stats?.xpEnabled ? "from-yellow-500 to-amber-500" : "from-slate-500 to-slate-600",
    },
  ];

  const bots = [
    {
      name: "FORGE",
      title: "살아있는 커뮤니티",
      description: "유저가 활동할수록 보상이 쌓이는 경제 시스템. 떠나고 싶지 않은 '재미있는 서버'를 시스템이 알아서 만들어줍니다.",
      href: `/dashboard/${guildId}/forge`,
      logo: "/logo/forge_logo.png",
      color: "from-emerald-500 to-green-500",
      available: true,
    },
    {
      name: "LINKA",
      title: "스마트한 관리",
      description: "관리자 실적, 권한 부여, 운영 로그... 흩어진 관리 기능을 하나로 묶어 운영진의 피로도를 0으로 만듭니다.",
      href: `/dashboard/${guildId}/linka`,
      logo: "/logo/linka_logo.png",
      color: "from-blue-500 to-cyan-500",
      available: false,
    },
    {
      name: "CORE",
      title: "완벽한 방어",
      description: "테러와 어뷰징으로부터 서버를 철벽 방어합니다. 검열부터 비정상 유저 차단까지, 서버의 '생존'을 책임집니다.",
      href: `/dashboard/${guildId}/core`,
      logo: "/logo/core_logo.png",
      color: "from-red-500 to-orange-500",
      available: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">대시보드</h1>
        <p className="text-white/50 mt-1">
          {guild?.name ?? "서버"} 관리 대시보드
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mainStats.map((stat, index) => (
          <div
            key={stat.label}
            className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Background gradient on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />

            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/50 text-sm">{stat.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon icon={stat.icon} className="w-4 h-4 text-white" />
                </div>
              </div>

              {stat.isStatus ? (
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  stat.isActive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-white/10 text-white/50"
                }`}>
                  <Icon
                    icon={stat.isActive ? "solar:check-circle-linear" : "solar:close-circle-linear"}
                    className="w-4 h-4"
                  />
                  {stat.value}
                </span>
              ) : (
                <>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  {stat.subValue && (
                    <p className="text-sm text-white/40 mt-1">{stat.subValue}</p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Stats Link */}
      <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <Link href={`/dashboard/${guildId}/stats`}>
          <div className="group bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 rounded-2xl p-5 border border-indigo-500/20 hover:border-indigo-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Icon icon="solar:chart-2-bold" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">상세 통계 보기</h3>
                  <p className="text-xs text-white/50">회원수 추이, XP 분포, 경제 지표 등</p>
                </div>
              </div>
              <Icon icon="solar:arrow-right-linear" className="w-5 h-5 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* Bot Selection */}
      <div className="animate-fade-up" style={{ animationDelay: "250ms" }}>
        <h2 className="text-lg font-semibold text-white mb-4">봇 설정</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Link key={bot.name} href={bot.href}>
              <div className={`group relative h-full bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 ${!bot.available ? 'opacity-60' : ''}`}>
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${bot.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />

                <div className="relative">
                  {/* Logo */}
                  <div className="w-full h-40 mb-4 group-hover:scale-105 transition-transform">
                    <img src={bot.logo} alt={bot.name} className="w-full h-full object-contain" />
                  </div>

                  {/* Bot Name & Status */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-white transition-colors">
                      {bot.name}
                    </h3>
                    {!bot.available && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/50">
                        준비 중
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p className={`text-sm font-medium bg-gradient-to-r ${bot.color} bg-clip-text text-transparent mb-2`}>
                    {bot.title}
                  </p>

                  {/* Description */}
                  <p className="text-white/40 text-sm leading-relaxed">
                    {bot.description}
                  </p>

                  {/* Arrow */}
                  <div className="mt-4 flex items-center text-white/30 group-hover:text-white/60 transition-colors">
                    <span className="text-sm">{bot.available ? '설정하기' : '곧 출시'}</span>
                    <Icon icon="solar:arrow-right-linear" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bot Status Warning */}
      {!guild?.botJoined && (
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20 backdrop-blur-sm rounded-2xl border border-amber-500/30 p-6 animate-fade-up" style={{ animationDelay: "300ms" }}>
          {/* Background Glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Icon icon="solar:danger-triangle-linear" className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-400">봇이 서버에 없습니다</h3>
                <p className="text-white/50 text-sm">
                  봇을 서버에 초대해야 모든 기능을 사용할 수 있습니다
                </p>
              </div>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25"
            >
              <a href={getBotInviteUrl(guildId)} target="_blank" rel="noopener noreferrer">
                <DiscordIcon className="w-5 h-5 mr-2" />
                봇 초대하기
                <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
