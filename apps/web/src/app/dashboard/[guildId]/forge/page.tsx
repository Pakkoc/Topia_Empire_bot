"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  useGuildStats,
  useCurrencySettings,
  useTreasury,
  useCurrencyStats,
  useLevelDistribution,
  useTreasuryStats,
} from "@/hooks/queries";
import { TransactionDistributionChart } from "@/components/charts/transaction-distribution-chart";
import { LevelDistributionChart } from "@/components/charts/level-distribution-chart";
import { TreasuryTrendChart } from "@/components/charts/treasury-trend-chart";

export default function ForgePage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);
  const { data: currencySettings, isLoading: currencyLoading } = useCurrencySettings(guildId);
  const { data: treasuryData, isLoading: treasuryLoading } = useTreasury(guildId);
  const { data: currencyStats, isLoading: currencyStatsLoading } = useCurrencyStats(guildId);
  const { data: levelDistribution, isLoading: levelLoading } = useLevelDistribution(guildId);
  const { data: treasuryStats, isLoading: treasuryStatsLoading } = useTreasuryStats(guildId);

  const isLoading = statsLoading || currencyLoading || treasuryLoading;
  const topyName = currencySettings?.topyName ?? "토피";

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl p-8 border border-white/5">
              <div className="h-12 w-12 rounded-xl bg-white/10 mb-4" />
              <div className="h-6 w-32 rounded bg-white/10 mb-2" />
              <div className="h-4 w-48 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const systems = [
    {
      name: "XP 시스템",
      description: "유저 활동에 따른 경험치 지급 및 레벨업 시스템",
      href: `/dashboard/${guildId}/forge/xp/settings`,
      icon: "solar:bolt-bold",
      color: "from-yellow-500 to-amber-500",
      enabled: stats?.xpEnabled ?? false,
      stats: [
        { label: "평균 텍스트 XP", value: stats?.avgTextXpPerMember?.toLocaleString() ?? "0" },
        { label: "평균 텍스트 레벨", value: `Lv. ${stats?.avgTextLevelExcludeZero ?? 0}` },
        { label: "평균 음성 XP", value: stats?.avgVoiceXpPerMember?.toLocaleString() ?? "0" },
        { label: "평균 음성 레벨", value: `Lv. ${stats?.avgVoiceLevelExcludeZero ?? 0}` },
      ],
    },
    {
      name: "화폐 시스템",
      description: "서버 내 경제 활동을 위한 화폐 시스템",
      href: `/dashboard/${guildId}/forge/currency/settings`,
      icon: "solar:wallet-bold",
      color: "from-emerald-500 to-green-500",
      enabled: currencySettings?.enabled ?? false,
      stats: [
        { label: "화폐명", value: currencySettings?.topyName ?? "토피" },
        { label: "유상 화폐", value: currencySettings?.rubyName ?? "루비" },
        { label: "총 발행량", value: `${Number(treasuryData?.totalSupply?.topy ?? 0).toLocaleString()} ${currencySettings?.topyName ?? "토피"}` },
        { label: "국고", value: `${Number(treasuryData?.treasury?.topyBalance ?? 0).toLocaleString()} ${currencySettings?.topyName ?? "토피"}` },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
            <img src="/logo/forge_logo.png" alt="FORGE" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">FORGE</h1>
            <p className="text-white/50">살아있는 커뮤니티를 위한 경제 시스템</p>
          </div>
        </div>
      </div>

      {/* System Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {systems.map((system, index) => (
          <Link key={system.name} href={system.href}>
            <div
              className="group relative h-full bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${system.color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />

              <div className="relative">
                {/* Icon & Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${system.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <Icon icon={system.icon} className="w-7 h-7 text-white" />
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    system.enabled
                      ? "bg-green-500/20 text-green-400"
                      : "bg-white/10 text-white/50"
                  }`}>
                    {system.enabled ? "활성화" : "비활성화"}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white transition-colors">
                  {system.name}
                </h3>
                <p className="text-white/40 text-sm mb-6">
                  {system.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  {system.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-white/40 text-xs mb-1">{stat.label}</p>
                      <p className="text-white font-semibold">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Arrow */}
                <div className="absolute bottom-8 right-8 text-white/30 group-hover:text-white/60 transition-colors">
                  <Icon icon="solar:arrow-right-linear" className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics Charts Section */}
      <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-lg font-semibold text-white mb-4">통계</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* 거래 유형 분포 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                <Icon icon="solar:chart-2-bold" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">거래 유형 분포</h3>
                <p className="text-xs text-white/40">최근 30일</p>
              </div>
            </div>
            <TransactionDistributionChart
              data={currencyStats?.distribution ?? []}
              isLoading={currencyStatsLoading}
            />
          </div>

          {/* XP 레벨 분포 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
                <Icon icon="solar:chart-bold" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">XP 레벨 분포</h3>
                <p className="text-xs text-white/40">전체 멤버</p>
              </div>
            </div>
            <LevelDistributionChart
              textData={levelDistribution?.textDistribution ?? []}
              voiceData={levelDistribution?.voiceDistribution ?? []}
              isLoading={levelLoading}
            />
          </div>

          {/* 국고 수입/지출 추이 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Icon icon="solar:wallet-money-bold" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">국고 추이</h3>
                <p className="text-xs text-white/40">최근 7일</p>
              </div>
            </div>
            <TreasuryTrendChart
              data={treasuryStats?.dailyTrend ?? []}
              totalIncome={treasuryStats?.totalIncome ?? 0}
              totalExpense={treasuryStats?.totalExpense ?? 0}
              isLoading={treasuryStatsLoading}
              currencyName={topyName}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
