"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  useMarketListings,
  useCancelMarketListing,
  useCurrencySettings,
  MarketCategory,
  MarketStatus,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/hooks/queries";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Icon } from "@iconify/react";
import { useDebounce } from "react-use";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const FEE_RATES = {
  topy: 5,
  ruby: 3,
};

export default function MarketPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const [page, setPage] = useState(1);
  const [sellerIdInput, setSellerIdInput] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState<MarketStatus | "all">("all");
  const [category, setCategory] = useState<MarketCategory | "all">("all");
  const [currencyType, setCurrencyType] = useState<"topy" | "ruby" | "all">("all");
  const [mounted, setMounted] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDebounce(
    () => {
      setSellerId(sellerIdInput);
      setPage(1);
    },
    300,
    [sellerIdInput]
  );

  const { data, isLoading, error } = useMarketListings(guildId, page, 20, {
    status: status === "all" ? undefined : status,
    category: category === "all" ? undefined : category,
    currencyType: currencyType === "all" ? undefined : currencyType,
    sellerId: sellerId || undefined,
  });

  const { data: settings } = useCurrencySettings(guildId);
  const cancelMutation = useCancelMarketListing(guildId);
  const { toast } = useToast();

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  const formatPrice = (price: string) => {
    return BigInt(price).toLocaleString();
  };

  const resetFilters = () => {
    setSellerIdInput("");
    setSellerId("");
    setStatus("all");
    setCategory("all");
    setCurrencyType("all");
    setPage(1);
  };

  const hasFilters =
    sellerId || status !== "all" || category !== "all" || currencyType !== "all";

  const handleCancelClick = (id: string, title: string) => {
    setCancelTarget({ id, title });
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;

    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      toast({ title: "상품이 취소되었습니다." });
    } catch {
      toast({ title: "상품 취소에 실패했습니다.", variant: "destructive" });
    } finally {
      setCancelDialogOpen(false);
      setCancelTarget(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">장터 관리</h1>
        <p className="text-white/50 mt-1">
          서버의 장터 상품을 관리합니다 (수수료: {topyName} {FEE_RATES.topy}%, {rubyName} {FEE_RATES.ruby}%)
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Icon icon="solar:filter-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">필터</h3>
            <p className="text-white/50 text-sm">장터 상품을 필터링합니다</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Seller ID Search */}
          <div className="relative">
            <Icon
              icon="solar:user-linear"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
            />
            <Input
              placeholder="판매자 ID로 검색..."
              value={sellerIdInput}
              onChange={(e) => setSellerIdInput(e.target.value)}
              className="bg-white/5 border-white/10 text-white pl-10"
            />
          </div>

          {/* Status */}
          {mounted ? (
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as MarketStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
          )}

          {/* Category */}
          {mounted ? (
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value as MarketCategory | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 카테고리</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 bg-white/5 border border-white/10 rounded-lg animate-pulse" />
          )}

          {/* Currency Type */}
          {mounted ? (
            <Select
              value={currencyType}
              onValueChange={(value) => {
                setCurrencyType(value as "topy" | "ruby" | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="화폐" />
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
          <p className="text-white/50 text-sm mt-4">총 {data.total}개의 상품</p>
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
          <p className="text-red-400">장터 목록을 불러오는데 실패했습니다.</p>
        </div>
      )}

      {/* Empty State */}
      {data && data.listings.length === 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
          <Icon icon="solar:shop-linear" className="mx-auto h-12 w-12 text-white/30" />
          <p className="mt-4 text-white/50">등록된 상품이 없습니다.</p>
          <p className="text-sm text-white/30">
            {hasFilters
              ? "필터 조건에 맞는 상품이 없습니다."
              : "유저들이 /장터 명령어로 상품을 등록하면 여기에 표시됩니다."}
          </p>
        </div>
      )}

      {/* Listings List */}
      {data && data.listings.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-white/5">
            <div className="col-span-4 text-white/50 text-sm font-medium">상품</div>
            <div className="col-span-2 text-white/50 text-sm font-medium">카테고리</div>
            <div className="col-span-2 text-white/50 text-sm font-medium text-right">가격</div>
            <div className="col-span-2 text-white/50 text-sm font-medium text-center">상태</div>
            <div className="col-span-2 text-white/50 text-sm font-medium text-right">관리</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {data.listings.map((listing) => {
              const isExpiringSoon =
                listing.status === "active" &&
                new Date(listing.expiresAt) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

              return (
                <div
                  key={listing.id}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 p-4 hover:bg-white/5 transition-colors"
                >
                  {/* Title & Seller */}
                  <div className="col-span-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Icon
                          icon={CATEGORY_ICONS[listing.category]}
                          className="h-5 w-5 text-white/70"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{listing.title}</p>
                        <p className="text-white/40 text-xs mt-0.5">
                          판매자: {listing.sellerId}
                        </p>
                        {listing.description && (
                          <p className="text-white/30 text-xs mt-1 line-clamp-1">
                            {listing.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="col-span-2 flex items-center">
                    <Badge
                      variant="outline"
                      className="border-white/20 text-white/70"
                    >
                      {CATEGORY_LABELS[listing.category]}
                    </Badge>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 flex items-center justify-end">
                    <div className="text-right">
                      <p className="text-white font-bold">
                        {formatPrice(listing.price)}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          listing.currencyType === "topy"
                            ? "border-amber-500/30 text-amber-400"
                            : "border-pink-500/30 text-pink-400"
                        }`}
                      >
                        {listing.currencyType === "topy" ? topyName : rubyName}
                      </Badge>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[listing.status]}
                    >
                      {STATUS_LABELS[listing.status]}
                    </Badge>
                    {listing.status === "active" && (
                      <span
                        className={`text-xs mt-1 ${
                          isExpiringSoon ? "text-orange-400" : "text-white/30"
                        }`}
                      >
                        {formatDistanceToNow(new Date(listing.expiresAt), {
                          locale: ko,
                          addSuffix: true,
                        })}{" "}
                        만료
                      </span>
                    )}
                    {listing.status === "sold" && listing.soldAt && (
                      <span className="text-xs text-white/30 mt-1">
                        {format(new Date(listing.soldAt), "MM.dd HH:mm", { locale: ko })}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {listing.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(listing.id, listing.title)}
                        disabled={cancelMutation.isPending}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Icon icon="solar:close-circle-linear" className="h-4 w-4 mr-1" />
                        취소
                      </Button>
                    )}
                    {listing.buyerId && (
                      <span className="text-xs text-white/40">
                        구매자: {listing.buyerId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <p className="text-sm text-white/50">
                페이지 {page} / {totalPages}
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
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
              장터는 유저들이 Discord에서 /장터 명령어로 등록한 상품 목록입니다.
            </p>
            <p className="mt-1 text-sm text-blue-200/70">
              관리자는 여기서 상품을 취소(삭제)할 수 있습니다. 구매는 Discord에서만 가능합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">상품 취소</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              &quot;{cancelTarget?.title}&quot; 상품을 취소하시겠습니까?
              <br />
              취소된 상품은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white hover:bg-white/10">
              아니요
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              취소하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
