"use client";

import { useParams } from "next/navigation";
import { Icon } from "@iconify/react";
import {
  useGuildStats,
  useMemberTrend,
  useCurrencyStats,
  useLevelDistribution,
  useTreasuryStats,
  useWalletDistribution,
  useXpDailyTrend,
} from "@/hooks/queries";
import { MemberTrendChart } from "@/components/charts/member-trend-chart";
import { TransactionDistributionChart } from "@/components/charts/transaction-distribution-chart";
import { LevelDistributionChart } from "@/components/charts/level-distribution-chart";
import { TreasuryTrendChart } from "@/components/charts/treasury-trend-chart";
import { WalletDistributionChart } from "@/components/charts/wallet-distribution-chart";
import { XpDailyTrendChart } from "@/components/charts/xp-daily-trend-chart";
import { ActiveUsersChart } from "@/components/charts/active-users-chart";

export default function StatsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const { data: stats, isLoading: statsLoading } = useGuildStats(guildId);
  const { data: monthlyTrend, isLoading: monthlyLoading } = useMemberTrend(guildId, "monthly");
  const { data: yearlyTrend, isLoading: yearlyLoading } = useMemberTrend(guildId, "yearly");
  const { data: currencyStats, isLoading: currencyStatsLoading } = useCurrencyStats(guildId);
  const { data: levelDistribution, isLoading: levelLoading } = useLevelDistribution(guildId);
  const { data: treasuryStats, isLoading: treasuryStatsLoading } = useTreasuryStats(guildId);
  const { data: walletDistribution, isLoading: walletLoading } = useWalletDistribution(guildId);
  const { data: xpDailyTrend, isLoading: xpTrendLoading } = useXpDailyTrend(guildId);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <Icon icon="solar:chart-2-bold" className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">통계</h1>
            <p className="text-white/50">서버의 전체 통계를 확인하세요</p>
          </div>
        </div>
      </div>

      {/* 핵심 지표 요약 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">총 멤버</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Icon icon="solar:users-group-rounded-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalMembers?.toLocaleString() ?? "0"}</p>
          <p className="text-xs text-white/40 mt-1">XP 보유: {stats?.membersWithXp?.toLocaleString() ?? "0"}명</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">오늘 활동</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Icon icon="solar:chat-line-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{((stats?.todayTextActive ?? 0) + (stats?.todayVoiceActive ?? 0)).toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-1">텍스트 {stats?.todayTextActive ?? 0} / 음성 {stats?.todayVoiceActive ?? 0}</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">총 XP</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
              <Icon icon="solar:bolt-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalXp?.toLocaleString() ?? "0"}</p>
          <p className="text-xs text-white/40 mt-1">평균 Lv. {stats?.avgTextLevelExcludeZero ?? 0}</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-sm">신규 가입 (30일)</span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Icon icon="solar:user-plus-bold" className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{monthlyTrend?.totalNewMembers?.toLocaleString() ?? "0"}</p>
          <p className="text-xs text-white/40 mt-1">일 평균 {monthlyTrend?.avgDailyNew ?? 0}명</p>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 animate-fade-up" style={{ animationDelay: "100ms" }}>
        {/* 회원수 추이 - 전체 너비 */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">회원수 추이</h3>
              <p className="text-xs text-white/40">총 회원수 및 신규 가입 추이</p>
            </div>
          </div>
          <MemberTrendChart
            monthlyData={monthlyTrend?.dailyTrend ?? []}
            yearlyData={yearlyTrend?.dailyTrend ?? []}
            isMonthlyLoading={monthlyLoading}
            isYearlyLoading={yearlyLoading}
          />
        </div>

        {/* 서버 참여율 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Icon icon="solar:users-group-rounded-bold" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">서버 참여율</h3>
              <p className="text-xs text-white/40">XP 보유 멤버 비율</p>
            </div>
          </div>
          <ActiveUsersChart
            totalMembers={stats?.totalMembers ?? 0}
            membersWithXp={stats?.membersWithXp ?? 0}
            todayTextActive={stats?.todayTextActive ?? 0}
            todayVoiceActive={stats?.todayVoiceActive ?? 0}
            isLoading={statsLoading}
          />
        </div>

        {/* 일별 XP 활동 추이 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Icon icon="solar:graph-up-bold" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">일별 XP 활동</h3>
              <p className="text-xs text-white/40">최근 7일</p>
            </div>
          </div>
          <XpDailyTrendChart
            data={xpDailyTrend?.dailyTrend ?? []}
            isLoading={xpTrendLoading}
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

        {/* 지갑 보유량 분포 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Icon icon="solar:wallet-bold" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">지갑 보유량 분포</h3>
              <p className="text-xs text-white/40">토피 기준</p>
            </div>
          </div>
          <WalletDistributionChart
            data={walletDistribution?.distribution ?? []}
            top10Percent={walletDistribution?.top10Percent ?? 0}
            isLoading={walletLoading}
            currencyName="토피"
          />
        </div>

        {/* 국고 추이 */}
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
            currencyName="토피"
          />
        </div>

        {/* 경제 지표 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
              <Icon icon="solar:scale-bold" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">경제 지표</h3>
              <p className="text-xs text-white/40">복지 지수 및 지니 계수</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* 복지 지수 */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">복지 지수</p>
              <p className="text-2xl font-bold text-white mb-2">{treasuryStats?.welfareIndex ?? 0}%</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mb-1">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-green-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min(treasuryStats?.welfareIndex ?? 0, 100)}%` }}
                />
              </div>
              <p className="text-xs text-white/40">
                {(treasuryStats?.welfareIndex ?? 0) >= 50 ? "적극적" : (treasuryStats?.welfareIndex ?? 0) >= 20 ? "보통" : "소극적"}
              </p>
            </div>
            {/* 지니 계수 */}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">지니 계수</p>
              <p className="text-2xl font-bold text-white mb-2">{walletDistribution?.giniCoefficient?.toFixed(2) ?? "0.00"}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mb-1">
                <div
                  className={`h-1.5 rounded-full ${
                    (walletDistribution?.giniCoefficient ?? 0) < 0.3
                      ? "bg-gradient-to-r from-green-500 to-emerald-500"
                      : (walletDistribution?.giniCoefficient ?? 0) < 0.5
                      ? "bg-gradient-to-r from-yellow-500 to-amber-500"
                      : "bg-gradient-to-r from-red-500 to-rose-500"
                  }`}
                  style={{ width: `${Math.min((walletDistribution?.giniCoefficient ?? 0) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-white/40">
                {(walletDistribution?.giniCoefficient ?? 0) < 0.3 ? "평등" : (walletDistribution?.giniCoefficient ?? 0) < 0.5 ? "보통" : "집중"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
