"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  useShopItems,
  useCreateShopItem,
  useUpdateShopItem,
  useDeleteShopItem,
  useRoles,
  useColorOptions,
  type ColorOption,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";
import { ITEM_TYPE_LABELS, type ShopItem, type ItemType } from "@/types/shop";

const shopItemFormSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0, "가격은 0 이상이어야 합니다"),
  currencyType: z.enum(["topy", "ruby"]),
  itemType: z.enum([
    "role",
    "color",
    "premium_room",
    "random_box",
    "warning_remove",
    "tax_exempt",
    "custom",
  ]),
  durationDays: z.coerce.number().optional(),
  roleId: z.string().optional(),
  stock: z.coerce.number().optional(),
  maxPerUser: z.coerce.number().optional(),
});

type ShopItemFormValues = z.infer<typeof shopItemFormSchema>;

export default function ShopPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [colorManageItem, setColorManageItem] = useState<ShopItem | null>(null);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#FF0000");
  const [newColorRoleId, setNewColorRoleId] = useState("");
  const [newColorPrice, setNewColorPrice] = useState(0);

  // 새 아이템 생성 시 임시 색상 옵션 목록
  interface PendingColorOption {
    id: number;
    color: string;
    name: string;
    roleId: string;
    price: number;
  }
  const [pendingColors, setPendingColors] = useState<PendingColorOption[]>([]);
  const [pendingColorName, setPendingColorName] = useState("");
  const [pendingColorHex, setPendingColorHex] = useState("#FF0000");
  const [pendingColorRoleId, setPendingColorRoleId] = useState("");
  const [pendingColorPrice, setPendingColorPrice] = useState(0);

  const { data: items, isLoading } = useShopItems(guildId);
  const { data: roles } = useRoles(guildId);
  const { data: colorOptions } = useColorOptions(guildId, colorManageItem?.id ?? null);
  const createItem = useCreateShopItem(guildId);
  const updateItem = useUpdateShopItem(guildId);
  const deleteItem = useDeleteShopItem(guildId);

  const form = useForm<ShopItemFormValues>({
    resolver: zodResolver(shopItemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      currencyType: "topy",
      itemType: "custom",
      durationDays: undefined,
      roleId: "",
      stock: undefined,
      maxPerUser: undefined,
    },
  });

  // 현재 선택된 아이템 타입 감시
  const watchedItemType = form.watch("itemType");
  const watchedCurrencyType = form.watch("currencyType");

  // 임시 색상 추가
  const handleAddPendingColor = () => {
    if (!pendingColorName || !pendingColorHex || !pendingColorRoleId) {
      toast({
        title: "입력 오류",
        description: "모든 필드를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setPendingColors([
      ...pendingColors,
      {
        id: Date.now(),
        color: pendingColorHex.toUpperCase(),
        name: pendingColorName,
        roleId: pendingColorRoleId,
        price: pendingColorPrice,
      },
    ]);
    setPendingColorName("");
    setPendingColorHex("#FF0000");
    setPendingColorRoleId("");
    setPendingColorPrice(0);
  };

  // 임시 색상 삭제
  const handleRemovePendingColor = (id: number) => {
    setPendingColors(pendingColors.filter((c) => c.id !== id));
  };

  const onSubmit = async (data: ShopItemFormValues) => {
    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          data: {
            ...data,
            durationDays: data.durationDays || null,
            roleId: data.roleId || null,
            stock: data.stock || null,
            maxPerUser: data.maxPerUser || null,
          },
        });
        toast({ title: "아이템 수정 완료", description: "상점 아이템이 수정되었습니다." });
        setEditingItem(null);
      } else {
        // 색상 변경권인데 색상이 없으면 경고
        if (data.itemType === "color" && pendingColors.length === 0) {
          toast({
            title: "색상을 추가하세요",
            description: "색상 변경권은 최소 1개 이상의 색상이 필요합니다.",
            variant: "destructive",
          });
          return;
        }

        const newItem = await createItem.mutateAsync(data);

        // 색상 변경권이면 색상 옵션 일괄 생성
        if (data.itemType === "color" && pendingColors.length > 0) {
          for (const color of pendingColors) {
            await fetch(`/api/guilds/${guildId}/shop/items/${newItem.id}/colors`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                color: color.color,
                name: color.name,
                roleId: color.roleId,
                price: color.price,
              }),
            });
          }
          setPendingColors([]);
        }

        toast({ title: "아이템 생성 완료", description: "새 상점 아이템이 추가되었습니다." });
        setIsCreateOpen(false);
      }
      form.reset();
    } catch {
      toast({
        title: "오류 발생",
        description: "작업 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: ShopItem) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      description: item.description || "",
      price: item.price,
      currencyType: item.currencyType,
      itemType: item.itemType as ItemType,
      durationDays: item.durationDays || undefined,
      roleId: item.roleId || "",
      stock: item.stock || undefined,
      maxPerUser: item.maxPerUser || undefined,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말로 이 아이템을 삭제하시겠습니까?")) return;
    try {
      await deleteItem.mutateAsync(id);
      toast({ title: "삭제 완료", description: "아이템이 삭제되었습니다." });
    } catch {
      toast({
        title: "삭제 실패",
        description: "아이템 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleEnabled = async (item: ShopItem) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: { enabled: !item.enabled },
      });
    } catch {
      toast({
        title: "오류 발생",
        description: "상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleAddColorOption = async () => {
    if (!colorManageItem) return;

    if (!newColorName || !newColorHex || !newColorRoleId) {
      toast({
        title: "입력 오류",
        description: "모든 필드를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${colorManageItem.id}/colors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          color: newColorHex.toUpperCase(),
          name: newColorName,
          roleId: newColorRoleId,
          price: newColorPrice,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create color option");
      }

      // Refresh color options
      queryClient.invalidateQueries({ queryKey: ["color-options", guildId, colorManageItem.id] });

      setNewColorName("");
      setNewColorHex("#FF0000");
      setNewColorRoleId("");
      setNewColorPrice(0);
      toast({ title: "색상 추가 완료" });
    } catch {
      toast({
        title: "오류 발생",
        description: "색상 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteColorOption = async (colorId: number) => {
    if (!colorManageItem) return;

    try {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${colorManageItem.id}/colors/${colorId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete color option");
      }

      queryClient.invalidateQueries({ queryKey: ["color-options", guildId, colorManageItem.id] });
      toast({ title: "색상 삭제 완료" });
    } catch {
      toast({
        title: "오류 발생",
        description: "색상 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">아이템 이름</FormLabel>
              <FormControl>
                <Input {...field} className="bg-white/5 border-white/10 text-white" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">설명 (선택)</FormLabel>
              <FormControl>
                <Input {...field} className="bg-white/5 border-white/10 text-white" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 색상 변경권이 아닐 때만 가격 표시 */}
        {watchedItemType !== "color" ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70">가격</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currencyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70">화폐 종류</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="topy">토피</SelectItem>
                      <SelectItem value="ruby">루비</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <FormField
            control={form.control}
            name="currencyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">화폐 종류</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="topy">토피</SelectItem>
                    <SelectItem value="ruby">루비</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs text-white/40">
                  색상별 가격은 아래에서 설정합니다
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="itemType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">아이템 타입</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 역할 아이템일 때만 역할 선택 표시 */}
        {watchedItemType === "role" && (
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">부여할 역할</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="역할을 선택하세요" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${role.color.toString(16).padStart(6, "0")}` }}
                          />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs text-white/40">
                  구매 시 자동으로 부여될 역할
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 색상 변경권일 때 색상 관리 (새 아이템 생성 시만) */}
        {watchedItemType === "color" && !editingItem && (
          <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Icon icon="solar:palette-linear" className="h-4 w-4" />
              색상 옵션 관리
            </h4>

            {/* 색상 추가 폼 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">색상 이름</label>
                <Input
                  placeholder="빨강"
                  value={pendingColorName}
                  onChange={(e) => setPendingColorName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">색상 코드</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={pendingColorHex}
                    onChange={(e) => setPendingColorHex(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    placeholder="#FF0000"
                    value={pendingColorHex}
                    onChange={(e) => setPendingColorHex(e.target.value)}
                    className="bg-white/5 border-white/10 text-white flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">역할</label>
                <Select onValueChange={setPendingColorRoleId} value={pendingColorRoleId}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="역할 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `#${role.color.toString(16).padStart(6, "0")}` }}
                          />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">
                  가격 ({watchedCurrencyType === "ruby" ? "루비" : "토피"})
                </label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={pendingColorPrice || ""}
                  onChange={(e) => setPendingColorPrice(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleAddPendingColor}
              size="sm"
              className="bg-gradient-to-r from-amber-600 to-orange-600"
            >
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              색상 추가
            </Button>

            {/* 추가된 색상 목록 */}
            {pendingColors.length > 0 && (
              <div className="space-y-2 mt-4">
                <label className="text-xs text-white/50">추가된 색상 ({pendingColors.length}개)</label>
                {pendingColors.map((color) => {
                  const role = roles?.find((r) => r.id === color.roleId);
                  return (
                    <div
                      key={color.id}
                      className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded border border-white/10"
                          style={{ backgroundColor: color.color }}
                        />
                        <span className="text-white text-sm">{color.name}</span>
                        <span className="text-white/40 text-xs">{color.color}</span>
                        <span className="text-amber-400 text-sm">
                          {color.price.toLocaleString()} {watchedCurrencyType === "ruby" ? "루비" : "토피"}
                        </span>
                        {role && (
                          <span className="text-white/50 text-xs">→ @{role.name}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePendingColor(color.id)}
                        className="h-6 w-6"
                      >
                        <Icon icon="solar:trash-bin-2-linear" className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {pendingColors.length === 0 && (
              <p className="text-xs text-white/30 mt-2">
                색상을 최소 1개 이상 추가해야 합니다.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="durationDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">유효 기간 (일)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="무제한"
                    {...field}
                    value={field.value || ""}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </FormControl>
                <FormDescription className="text-xs text-white/40">
                  비워두면 무제한
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">재고</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="무제한"
                    {...field}
                    value={field.value || ""}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </FormControl>
                <FormDescription className="text-xs text-white/40">
                  비워두면 무제한
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="maxPerUser"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">유저당 최대 구매 횟수</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="무제한"
                  {...field}
                  value={field.value || ""}
                  className="bg-white/5 border-white/10 text-white"
                />
              </FormControl>
              <FormDescription className="text-xs text-white/40">
                비워두면 무제한
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingItem(null);
              form.reset();
              setPendingColors([]);
              setPendingColorName("");
              setPendingColorHex("#FF0000");
              setPendingColorRoleId("");
              setPendingColorPrice(0);
            }}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={createItem.isPending || updateItem.isPending}
            className="bg-gradient-to-r from-amber-600 to-orange-600"
          >
            {editingItem ? "수정" : "추가"}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="animate-fade-up">
          <h1 className="text-2xl md:text-3xl font-bold text-white">상점 관리</h1>
          <p className="text-white/50 mt-1">토피/루비로 구매할 수 있는 아이템을 관리합니다</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-amber-600 to-orange-600">
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              아이템 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">새 아이템 추가</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open: boolean) => !open && setEditingItem(null)}>
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">아이템 수정</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      {/* Color Options Dialog */}
      <Dialog open={!!colorManageItem} onOpenChange={(open: boolean) => !open && setColorManageItem(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              색상 관리 - {colorManageItem?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* 색상 추가 폼 */}
            <div className="space-y-4 p-4 bg-white/5 rounded-xl">
              <h4 className="text-sm font-medium text-white/70">새 색상 추가</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">색상 이름</label>
                  <Input
                    placeholder="빨강"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">색상 코드</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      placeholder="#FF0000"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="bg-white/5 border-white/10 text-white flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">역할</label>
                  <Select onValueChange={setNewColorRoleId} value={newColorRoleId}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="역할 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: `#${role.color.toString(16).padStart(6, "0")}` }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">가격</label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={newColorPrice || ""}
                    onChange={(e) => setNewColorPrice(Number(e.target.value))}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
              <Button
                onClick={handleAddColorOption}
                className="bg-gradient-to-r from-amber-600 to-orange-600"
              >
                <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                색상 추가
              </Button>
            </div>

            {/* 색상 목록 */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white/70">등록된 색상</h4>
              {colorOptions && colorOptions.length > 0 ? (
                <div className="space-y-2">
                  {colorOptions.map((option) => {
                    const role = roles?.find(r => r.id === option.roleId);
                    return (
                      <div
                        key={option.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg border border-white/10"
                            style={{ backgroundColor: option.color }}
                          />
                          <div>
                            <span className="text-white font-medium">{option.name}</span>
                            <span className="text-white/40 ml-2">{option.color}</span>
                          </div>
                          <span className="text-amber-400 font-medium">
                            {option.price.toLocaleString()} {colorManageItem?.currencyType === "ruby" ? "루비" : "토피"}
                          </span>
                          <div className="text-white/50">→</div>
                          <div className="flex items-center gap-2">
                            {role && (
                              <>
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: `#${role.color.toString(16).padStart(6, "0")}` }}
                                />
                                <span className="text-white/70">@{role.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteColorOption(option.id)}
                        >
                          <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-white/40">
                  등록된 색상이 없습니다
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Items List */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon icon="solar:shop-linear" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">상점 아이템</h3>
              <p className="text-white/50 text-sm">
                {items?.length || 0}개의 아이템
              </p>
            </div>
          </div>
        </div>

        {items && items.length > 0 ? (
          <div className="divide-y divide-white/10">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.currencyType === "topy"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-pink-500/20 text-pink-400"
                    }`}
                  >
                    <Icon
                      icon={
                        item.currencyType === "topy"
                          ? "solar:coin-linear"
                          : "solar:diamond-linear"
                      }
                      className="h-5 w-5"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{item.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          item.enabled
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {item.enabled ? "활성" : "비활성"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/50">
                      <span>
                        {item.price.toLocaleString()}{" "}
                        {item.currencyType === "topy" ? "토피" : "루비"}
                      </span>
                      <span>•</span>
                      <span>{ITEM_TYPE_LABELS[item.itemType as ItemType]}</span>
                      {item.stock !== null && (
                        <>
                          <span>•</span>
                          <span>재고: {item.stock}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.itemType === "color" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setColorManageItem(item)}
                      className="text-white/50 hover:text-white"
                    >
                      <Icon icon="solar:palette-linear" className="h-4 w-4 mr-1" />
                      색상 관리
                    </Button>
                  )}
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={() => handleToggleEnabled(item)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(item)}
                  >
                    <Icon icon="solar:pen-linear" className="h-4 w-4 text-white/50" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Icon
              icon="solar:bag-smile-linear"
              className="h-12 w-12 text-white/20 mx-auto mb-4"
            />
            <p className="text-white/50">등록된 아이템이 없습니다</p>
            <p className="text-white/30 text-sm mt-1">
              위의 &quot;아이템 추가&quot; 버튼을 눌러 새 아이템을 추가하세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
