"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useCurrencyWallets, useCurrencyLeaderboard, useCurrencySettings } from "@/hooks/queries";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { useDebounce } from "react-use";

export default function WalletsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useDebounce(
    () => {
      setSearch(searchInput);
      setPage(1);
    },
    300,
    [searchInput]
  );

  const { data, isLoading, error } = useCurrencyWallets(guildId, page, 20, search);
  const { data: leaderboardData } = useCurrencyLeaderboard(guildId, "topy", 5);
  const { data: settings } = useCurrencySettings(guildId);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  const formatBalance = (balance: string) => {
    return BigInt(balance).toLocaleString();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">지갑 관리</h1>
        <p className="text-white/50 mt-1">서버 멤버의 {topyName}/{rubyName} 잔액을 확인합니다</p>
      </div>

      {/* Top 5 Leaderboard */}
      {leaderboardData && leaderboardData.leaderboard.length > 0 && (
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl border border-amber-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon icon="solar:crown-linear" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{topyName} 랭킹 TOP 5</h3>
              <p className="text-white/50 text-sm">가장 많은 {topyName}를 보유한 유저</p>
            </div>
          </div>
          <div className="grid gap-2">
            {leaderboardData.leaderboard.map((entry) => (
              <div
                key={entry.userId}
                className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <span className="w-8 text-center text-lg text-white/70 font-bold">
                  #{entry.rank}
                </span>
                <div className="flex-1">
                  <p className="text-white font-medium truncate">
                    {entry.userId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold">
                    {formatBalance(entry.balance)} {topyName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="유저 ID로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-white/5 border-white/10 text-white pl-10"
          />
        </div>
        {data && (
          <p className="text-white/50 text-sm">
            총 {data.pagination.total}개의 지갑
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12">
          <div className="flex items-center justify-center gap-2 text-white/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
            <span>로딩 중...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl border border-red-500/20 p-8 text-center">
          <p className="text-red-400">지갑 목록을 불러오는데 실패했습니다.</p>
        </div>
      )}

      {/* Empty State */}
      {data && data.wallets.length === 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
          <Icon icon="solar:wallet-linear" className="mx-auto h-12 w-12 text-white/30" />
          <p className="mt-4 text-white/50">지갑 데이터가 없습니다.</p>
          <p className="text-sm text-white/30">
            활동을 통해 {topyName}를 획득하면 여기에 표시됩니다.
          </p>
        </div>
      )}

      {/* Wallets List */}
      {data && data.wallets.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-white/5">
            <div className="col-span-1 text-white/50 text-sm font-medium">#</div>
            <div className="col-span-5 text-white/50 text-sm font-medium">유저 ID</div>
            <div className="col-span-3 text-white/50 text-sm font-medium text-right">{topyName}</div>
            <div className="col-span-3 text-white/50 text-sm font-medium text-right">{rubyName}</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {data.wallets.map((wallet, index) => (
              <div
                key={wallet.userId}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors"
              >
                <div className="col-span-1 text-white/50 text-sm">
                  {(page - 1) * 20 + index + 1}
                </div>
                <div className="col-span-5 truncate">
                  <p className="text-white font-medium truncate">{wallet.userId}</p>
                </div>
                <div className="col-span-3 text-right">
                  <p className="text-amber-400 font-bold">
                    {formatBalance(wallet.topyBalance)}
                  </p>
                  <p className="text-white/30 text-xs">
                    총 {formatBalance(wallet.topyTotalEarned)} 획득
                  </p>
                </div>
                <div className="col-span-3 text-right">
                  <p className="text-pink-400 font-bold">
                    {formatBalance(wallet.rubyBalance)}
                  </p>
                  <p className="text-white/30 text-xs">
                    총 {formatBalance(wallet.rubyTotalEarned)} 획득
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-sm text-white/50">
                페이지 {data.pagination.page} / {data.pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4 mr-1" />
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(data.pagination.totalPages, p + 1))
                  }
                  disabled={page === data.pagination.totalPages}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  다음
                  <Icon icon="solar:alt-arrow-right-linear" className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <Badge className="bg-blue-600">안내</Badge>
          <div>
            <p className="text-blue-100">
              <strong>활동형 화폐({topyName})</strong>: 채팅 및 음성 활동으로 획득합니다.
            </p>
            <p className="mt-1 text-sm text-blue-200/70">
              <strong>수익형 화폐({rubyName})</strong>: 구매 또는 장터 거래를 통해 획득합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
