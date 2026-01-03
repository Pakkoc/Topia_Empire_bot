"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCurrencyTransactions, useCurrencySettings, TransactionType, CurrencyType } from "@/hooks/queries";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { useDebounce } from "react-use";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  earn_text: "채팅 보상",
  earn_voice: "음성 보상",
  earn_attendance: "출석 보상",
  transfer_in: "송금 받음",
  transfer_out: "송금 보냄",
  shop_purchase: "상점 구매",
  market_buy: "장터 구매",
  market_sell: "장터 판매",
  tax: "세금",
  fee: "수수료",
  admin_add: "관리자 추가",
  admin_remove: "관리자 차감",
  game_bet: "게임 배팅",
  game_win: "게임 당첨",
  game_entry: "내전 참가비",
  game_reward: "내전 보상",
  game_refund: "게임 환불",
};

const TRANSACTION_TYPE_ICONS: Record<TransactionType, string> = {
  earn_text: "solar:chat-round-line-bold",
  earn_voice: "solar:microphone-bold",
  earn_attendance: "solar:calendar-bold",
  transfer_in: "solar:arrow-down-bold",
  transfer_out: "solar:arrow-up-bold",
  shop_purchase: "solar:bag-bold",
  market_buy: "solar:cart-large-bold",
  market_sell: "solar:tag-price-bold",
  tax: "solar:bill-bold",
  fee: "solar:hand-money-bold",
  admin_add: "solar:add-circle-bold",
  admin_remove: "solar:minus-circle-bold",
  game_bet: "solar:gamepad-bold",
  game_win: "solar:cup-star-bold",
  game_entry: "solar:ticket-bold",
  game_reward: "solar:medal-ribbons-star-bold",
  game_refund: "solar:undo-left-bold",
};

const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  earn_text: "text-green-400",
  earn_voice: "text-green-400",
  earn_attendance: "text-green-400",
  transfer_in: "text-blue-400",
  transfer_out: "text-orange-400",
  shop_purchase: "text-purple-400",
  market_buy: "text-indigo-400",
  market_sell: "text-teal-400",
  tax: "text-red-400",
  fee: "text-yellow-400",
  admin_add: "text-cyan-400",
  admin_remove: "text-red-400",
  game_bet: "text-amber-400",
  game_win: "text-emerald-400",
  game_entry: "text-orange-400",
  game_reward: "text-emerald-400",
  game_refund: "text-slate-400",
};

export default function TransactionsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const [page, setPage] = useState(1);
  const [userIdInput, setUserIdInput] = useState("");
  const [userId, setUserId] = useState("");
  const [currencyType, setCurrencyType] = useState<CurrencyType | "all">("all");
  const [transactionType, setTransactionType] = useState<TransactionType | "all">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDebounce(
    () => {
      setUserId(userIdInput);
      setPage(1);
    },
    300,
    [userIdInput]
  );

  const { data, isLoading, error } = useCurrencyTransactions(guildId, page, 20, {
    userId: userId || undefined,
    currencyType: currencyType === "all" ? undefined : currencyType,
    transactionType: transactionType === "all" ? undefined : transactionType,
  });
  const { data: settings } = useCurrencySettings(guildId);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  const formatAmount = (amount: string, type: TransactionType) => {
    let value = BigInt(amount);
    if (value < 0) value = -value; // 절대값
    const isNegative = type === "transfer_out" || type === "shop_purchase" || type === "market_buy" || type === "tax" || type === "fee" || type === "admin_remove" || type === "game_bet" || type === "game_entry";
    return `${isNegative ? "-" : "+"}${value.toLocaleString()}`;
  };

  const formatBalance = (balance: string) => {
    return BigInt(balance).toLocaleString();
  };

  const resetFilters = () => {
    setUserIdInput("");
    setUserId("");
    setCurrencyType("all");
    setTransactionType("all");
    setPage(1);
  };

  const hasFilters = userId || currencyType !== "all" || transactionType !== "all";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">거래 기록</h1>
        <p className="text-white/50 mt-1">서버의 {topyName}/{rubyName} 거래 내역을 확인합니다</p>
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Icon icon="solar:filter-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">필터</h3>
            <p className="text-white/50 text-sm">거래 내역을 필터링합니다</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* User ID Search */}
          <div className="relative">
            <Icon icon="solar:user-linear" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="유저 ID로 검색..."
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="bg-white/5 border-white/10 text-white pl-10"
            />
          </div>

          {/* Currency Type */}
          {mounted ? (
            <Select
              value={currencyType}
              onValueChange={(value) => {
                setCurrencyType(value as CurrencyType | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="화폐 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 화폐</SelectItem>
                <SelectItem value="topy">{topyName}</SelectItem>
                <SelectItem value="ruby">{rubyName}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
          )}

          {/* Transaction Type */}
          {mounted ? (
            <Select
              value={transactionType}
              onValueChange={(value) => {
                setTransactionType(value as TransactionType | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="거래 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
          )}

          {/* Reset Button */}
          {hasFilters && (
            <Button
              variant="outline"
              onClick={resetFilters}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Icon icon="solar:restart-linear" className="h-4 w-4 mr-2" />
              필터 초기화
            </Button>
          )}
        </div>

        {data && (
          <p className="text-white/50 text-sm mt-4">
            총 {data.pagination.total}건의 거래 기록
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
          <p className="text-red-400">거래 기록을 불러오는데 실패했습니다.</p>
        </div>
      )}

      {/* Empty State */}
      {data && data.transactions.length === 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
          <Icon icon="solar:document-text-linear" className="mx-auto h-12 w-12 text-white/30" />
          <p className="mt-4 text-white/50">거래 기록이 없습니다.</p>
          <p className="text-sm text-white/30">
            {hasFilters
              ? "필터 조건에 맞는 거래 기록이 없습니다."
              : `활동을 통해 ${topyName}를 획득하면 여기에 표시됩니다.`}
          </p>
        </div>
      )}

      {/* Transactions List */}
      {data && data.transactions.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-white/5">
            <div className="col-span-2 text-white/50 text-sm font-medium">유형</div>
            <div className="col-span-2 text-white/50 text-sm font-medium">유저</div>
            <div className="col-span-3 text-white/50 text-sm font-medium">사유</div>
            <div className="col-span-2 text-white/50 text-sm font-medium text-right">금액</div>
            <div className="col-span-1 text-white/50 text-sm font-medium text-right">잔액</div>
            <div className="col-span-2 text-white/50 text-sm font-medium text-right">일시</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {data.transactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-white/5 transition-colors"
              >
                {/* Type */}
                <div className="col-span-2 flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center ${TRANSACTION_TYPE_COLORS[tx.transactionType]}`}>
                    <Icon icon={TRANSACTION_TYPE_ICONS[tx.transactionType]} className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">
                      {TRANSACTION_TYPE_LABELS[tx.transactionType]}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-xs ${tx.currencyType === "topy" ? "border-amber-500/30 text-amber-400" : "border-pink-500/30 text-pink-400"}`}
                    >
                      {tx.currencyType === "topy" ? topyName : rubyName}
                    </Badge>
                  </div>
                </div>

                {/* User */}
                <div className="col-span-2 flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={tx.avatar ?? undefined} />
                    <AvatarFallback className="bg-white/10 text-white/70 text-xs">
                      {tx.displayName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{tx.displayName}</p>
                    <p className="text-white/40 text-xs truncate">{tx.userId}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="col-span-3 flex items-center">
                  <p className="text-white/70 text-sm truncate">
                    {tx.description || "-"}
                  </p>
                </div>

                {/* Amount */}
                <div className="col-span-2 flex items-center justify-end">
                  <p className={`font-bold text-sm ${
                    tx.transactionType === "transfer_out" ||
                    tx.transactionType === "shop_purchase" ||
                    tx.transactionType === "market_buy" ||
                    tx.transactionType === "tax" ||
                    tx.transactionType === "fee" ||
                    tx.transactionType === "admin_remove" ||
                    tx.transactionType === "game_bet" ||
                    tx.transactionType === "game_entry"
                      ? "text-red-400"
                      : "text-green-400"
                  }`}>
                    {formatAmount(tx.amount, tx.transactionType)}
                  </p>
                </div>

                {/* Balance */}
                <div className="col-span-1 flex items-center justify-end">
                  <p className="text-white/50 text-sm">
                    {formatBalance(tx.balanceAfter)}
                  </p>
                </div>

                {/* Date */}
                <div className="col-span-2 flex items-center justify-end">
                  <p className="text-white/40 text-xs">
                    {format(new Date(tx.createdAt), "MM.dd HH:mm", { locale: ko })}
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
              모든 거래 기록은 자동으로 저장됩니다.
            </p>
            <p className="mt-1 text-sm text-blue-200/70">
              필터를 사용하여 특정 유저, 화폐 유형, 거래 유형별로 기록을 검색할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
