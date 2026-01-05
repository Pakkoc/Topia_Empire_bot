"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useInventories,
  useUserInventory,
  useInventoryAction,
  useCurrencySettings,
  useShopItemsV2,
} from "@/hooks/queries";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { useDebounce } from "react-use";
import { useToast } from "@/hooks/use-toast";

export default function InventoryPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // 모달 상태
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"give" | "take">("give");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  // 유저 상세 모달
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState("");

  useDebounce(
    () => {
      setSearch(searchInput);
      setPage(1);
    },
    300,
    [searchInput]
  );

  const { toast } = useToast();

  const { data, isLoading, error, refetch } = useInventories(guildId, page, 20, search);
  const { data: settings } = useCurrencySettings(guildId);
  const { data: shopItems } = useShopItemsV2(guildId);
  const { data: userInventoryData } = useUserInventory(guildId, detailUserId);
  const inventoryAction = useInventoryAction(guildId);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  const handleOpenGiveModal = () => {
    setActionType("give");
    setSelectedUserId("");
    setSelectedItemId(null);
    setQuantity(1);
    setIsActionModalOpen(true);
  };

  const handleOpenTakeModal = (userId: string) => {
    setActionType("take");
    setSelectedUserId(userId);
    setSelectedItemId(null);
    setQuantity(1);
    setIsActionModalOpen(true);
  };

  const handleOpenDetailModal = (userId: string) => {
    setDetailUserId(userId);
    setIsDetailModalOpen(true);
  };

  const handleAction = async () => {
    if (!selectedUserId || !selectedItemId) {
      toast({ variant: "destructive", title: "오류", description: "유저 ID와 아이템을 선택해주세요." });
      return;
    }

    try {
      const result = await inventoryAction.mutateAsync({
        userId: selectedUserId,
        shopItemId: selectedItemId,
        quantity,
        action: actionType,
      });

      toast({ title: "성공", description: result.message });
      setIsActionModalOpen(false);
      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "오류",
        description: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
      });
    }
  };

  const getDaysLeft = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">인벤토리 관리</h1>
          <p className="text-white/50 mt-1">유저의 아이템을 조회하고 지급/회수합니다</p>
        </div>
        <Button
          onClick={handleOpenGiveModal}
          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
        >
          <Icon icon="solar:gift-bold" className="w-4 h-4 mr-2" />
          아이템 지급
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Icon
            icon="solar:magnifer-linear"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          />
          <Input
            placeholder="유저 ID로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-white/5 border-white/10 text-white pl-10"
          />
        </div>
        {data && (
          <p className="text-white/50 text-sm">
            총 {data.pagination.total}명의 유저
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
          <p className="text-red-400">인벤토리 목록을 불러오는데 실패했습니다.</p>
        </div>
      )}

      {/* Empty State */}
      {data && data.inventories.length === 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
          <Icon icon="solar:box-linear" className="mx-auto h-12 w-12 text-white/30" />
          <p className="mt-4 text-white/50">인벤토리 데이터가 없습니다.</p>
          <p className="text-sm text-white/30">
            상점에서 아이템을 구매하거나, 관리자가 아이템을 지급하면 여기에 표시됩니다.
          </p>
        </div>
      )}

      {/* Inventories List */}
      {data && data.inventories.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-white/5">
            <div className="col-span-1 text-white/50 text-sm font-medium">#</div>
            <div className="col-span-4 text-white/50 text-sm font-medium">유저 ID</div>
            <div className="col-span-4 text-white/50 text-sm font-medium">보유 아이템</div>
            <div className="col-span-3 text-white/50 text-sm font-medium text-right">관리</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {data.inventories.map((inventory, index) => (
              <div
                key={inventory.userId}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-white/5 transition-colors items-center"
              >
                <div className="col-span-1 text-white/50 text-sm">
                  {(page - 1) * 20 + index + 1}
                </div>
                <div className="col-span-4 truncate">
                  <p className="text-white font-medium truncate">{inventory.userId}</p>
                  <p className="text-white/40 text-xs">총 {inventory.totalItems}개 보유</p>
                </div>
                <div className="col-span-4">
                  <div className="flex flex-wrap gap-1">
                    {inventory.items.slice(0, 3).map((item) => (
                      <Badge
                        key={item.id}
                        variant="secondary"
                        className="bg-white/10 text-white/70 text-xs"
                      >
                        {item.itemName} x{item.quantity}
                      </Badge>
                    ))}
                    {inventory.items.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="bg-white/10 text-white/50 text-xs"
                      >
                        +{inventory.items.length - 3}개
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDetailModal(inventory.userId)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Icon icon="solar:eye-linear" className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenTakeModal(inventory.userId)}
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                  >
                    <Icon icon="solar:minus-circle-linear" className="w-4 h-4" />
                  </Button>
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

      {/* 아이템 지급/회수 모달 */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === "give" ? "🎁 아이템 지급" : "📦 아이템 회수"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {actionType === "give"
                ? "유저에게 아이템을 지급합니다."
                : "유저의 아이템을 회수합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 유저 ID 입력 */}
            <div className="space-y-2">
              <label className="text-sm text-white/70">유저 ID</label>
              <Input
                placeholder="유저 ID 입력..."
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                disabled={actionType === "take"}
              />
            </div>

            {/* 아이템 선택 */}
            <div className="space-y-2">
              <label className="text-sm text-white/70">아이템</label>
              <Select
                value={selectedItemId?.toString() ?? ""}
                onValueChange={(value) => setSelectedItemId(parseInt(value, 10))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="아이템 선택..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10">
                  {shopItems?.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id.toString()}
                      className="text-white hover:bg-white/10"
                    >
                      {item.name}
                      {item.durationDays > 0 && ` (${item.durationDays}일)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 수량 */}
            <div className="space-y-2">
              <label className="text-sm text-white/70">수량</label>
              <Input
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsActionModalOpen(false)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              취소
            </Button>
            <Button
              onClick={handleAction}
              disabled={inventoryAction.isPending}
              className={
                actionType === "give"
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : "bg-gradient-to-r from-orange-500 to-red-500"
              }
            >
              {inventoryAction.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : actionType === "give" ? (
                "지급하기"
              ) : (
                "회수하기"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 유저 상세 모달 */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>📦 유저 인벤토리</DialogTitle>
            <DialogDescription className="text-white/50">
              {detailUserId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {userInventoryData?.items.length === 0 && (
              <p className="text-center text-white/50 py-8">보유한 아이템이 없습니다.</p>
            )}

            {userInventoryData?.items.map((item) => {
              const daysLeft = getDaysLeft(item.expiresAt);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{item.itemName}</span>
                      <Badge variant="secondary" className="bg-white/10 text-white/70">
                        x{item.quantity}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-sm text-white/50 mt-1">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                      {item.itemType && (
                        <Badge variant="outline" className="border-white/20 text-white/50">
                          {item.itemType}
                        </Badge>
                      )}
                      {daysLeft !== null && (
                        <span className={daysLeft <= 3 ? "text-red-400" : ""}>
                          <Icon icon="solar:clock-circle-linear" className="w-3 h-3 inline mr-1" />
                          {daysLeft}일 남음
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setActionType("take");
                      setSelectedUserId(detailUserId);
                      setSelectedItemId(item.shopItemId);
                      setQuantity(1);
                      setIsActionModalOpen(true);
                    }}
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                  >
                    <Icon icon="solar:minus-circle-linear" className="w-4 h-4 mr-1" />
                    회수
                  </Button>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailModalOpen(false)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              닫기
            </Button>
            <Button
              onClick={() => {
                setIsDetailModalOpen(false);
                setActionType("give");
                setSelectedUserId(detailUserId);
                setSelectedItemId(null);
                setQuantity(1);
                setIsActionModalOpen(true);
              }}
              className="bg-gradient-to-r from-green-500 to-emerald-500"
            >
              <Icon icon="solar:gift-bold" className="w-4 h-4 mr-2" />
              아이템 지급
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <Badge className="bg-blue-600">안내</Badge>
          <div>
            <p className="text-blue-100">
              이 페이지에서 유저의 인벤토리를 관리할 수 있습니다.
            </p>
            <p className="mt-1 text-sm text-blue-200/70">
              아이템 지급 시 기간제 아이템은 자동으로 만료일이 연장됩니다.
              Discord 봇에서 /아이템지급, /아이템회수 명령어로도 관리할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
