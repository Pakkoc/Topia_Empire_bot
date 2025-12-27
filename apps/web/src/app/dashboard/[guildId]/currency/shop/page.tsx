"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useShopItemsV2,
  useCreateShopItemV2,
  useUpdateShopItemV2,
  useDeleteShopItemV2,
  useCurrencySettings,
  useUpdateCurrencySettings,
  useRoles,
  useTextChannels,
  useCreateShopPanel,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import type { ShopItemV2, InlineRoleOption } from "@/types/shop-v2";

// Pending role option for inline management
interface PendingRoleOption {
  tempId: number;
  name: string;
  roleId: string;
  description?: string;
}

const shopItemFormSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0, "가격은 0 이상이어야 합니다"),
  currencyType: z.enum(["topy", "ruby"]),
  durationDays: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().min(0).optional(),
  maxPerUser: z.coerce.number().min(1).optional(),
  enabled: z.boolean().optional(),
  // Role ticket toggle
  hasRoleTicket: z.boolean().optional(),
  consumeQuantity: z.coerce.number().min(0).optional(),
  removePreviousRole: z.boolean().optional(),
  effectDurationDays: z.coerce.number().min(0).optional(),
});

type ShopItemFormValues = z.infer<typeof shopItemFormSchema>;

export default function ShopV2Page() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItemV2 | null>(null);

  // Pending role options for new item creation
  const [pendingRoleOptions, setPendingRoleOptions] = useState<PendingRoleOption[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  // Panel settings
  const [selectedChannelId, setSelectedChannelId] = useState("");

  const { data: settings } = useCurrencySettings(guildId);
  const updateSettings = useUpdateCurrencySettings(guildId);
  const { data: items, isLoading } = useShopItemsV2(guildId);

  // 수수료 설정 상태
  const [shopFeeTopy, setShopFeeTopy] = useState<string>("0");
  const [shopFeeRuby, setShopFeeRuby] = useState<string>("0");
  const { data: roles } = useRoles(guildId);
  const { data: channels } = useTextChannels(guildId);
  const createItem = useCreateShopItemV2(guildId);
  const updateItem = useUpdateShopItemV2(guildId);
  const deleteItem = useDeleteShopItemV2(guildId);
  const createPanelMutation = useCreateShopPanel(guildId);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  // 설치된 채널이 있으면 초기값으로 설정
  useEffect(() => {
    if (settings?.shopChannelId) {
      setSelectedChannelId(settings.shopChannelId);
    }
  }, [settings?.shopChannelId]);

  // 수수료 설정 초기화
  useEffect(() => {
    if (settings) {
      setShopFeeTopy(String(settings.shopFeeTopyPercent ?? 0));
      setShopFeeRuby(String(settings.shopFeeRubyPercent ?? 0));
    }
  }, [settings]);

  // 수수료 저장
  const handleSaveFee = async () => {
    try {
      await updateSettings.mutateAsync({
        shopFeeTopyPercent: parseFloat(shopFeeTopy) || 0,
        shopFeeRubyPercent: parseFloat(shopFeeRuby) || 0,
      });
      toast({ title: "수수료 설정 저장 완료" });
    } catch {
      toast({ title: "수수료 설정 저장 실패", variant: "destructive" });
    }
  };

  const form = useForm<ShopItemFormValues>({
    resolver: zodResolver(shopItemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      currencyType: "topy",
      durationDays: 0,
      stock: undefined,
      maxPerUser: undefined,
      enabled: true,
      hasRoleTicket: false,
      consumeQuantity: 1,
      removePreviousRole: true,
      effectDurationDays: 0,
    },
  });

  const hasRoleTicket = form.watch("hasRoleTicket");

  // Add pending role option
  const handleAddRoleOption = () => {
    if (!newRoleName || !newRoleId) {
      toast({
        title: "입력 오류",
        description: "역할 이름과 역할을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setPendingRoleOptions([
      ...pendingRoleOptions,
      {
        tempId: Date.now(),
        name: newRoleName,
        roleId: newRoleId,
        description: newRoleDescription || undefined,
      },
    ]);
    setNewRoleName("");
    setNewRoleId("");
    setNewRoleDescription("");
  };

  // Remove pending role option
  const handleRemoveRoleOption = (tempId: number) => {
    setPendingRoleOptions(pendingRoleOptions.filter((opt) => opt.tempId !== tempId));
  };

  const resetForm = () => {
    form.reset();
    setPendingRoleOptions([]);
    setNewRoleName("");
    setNewRoleId("");
    setNewRoleDescription("");
  };

  const onSubmit = async (data: ShopItemFormValues) => {
    try {
      // Build role options from pending or existing
      const roleOptions: InlineRoleOption[] = pendingRoleOptions.map((opt) => ({
        name: opt.name,
        roleId: opt.roleId,
        description: opt.description,
      }));

      // Build role ticket if enabled
      // 효과 지속 기간: 일 -> 초 변환 (0이면 null = 영구)
      const effectDurationSeconds = data.effectDurationDays
        ? data.effectDurationDays * 24 * 60 * 60
        : null;

      const roleTicket = data.hasRoleTicket
        ? {
            consumeQuantity: data.consumeQuantity ?? 1,
            removePreviousRole: data.removePreviousRole ?? true,
            effectDurationSeconds,
            roleOptions,
          }
        : undefined;

      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          data: {
            name: data.name,
            description: data.description || null,
            price: data.price,
            currencyType: data.currencyType,
            durationDays: data.durationDays ?? 0,
            stock: data.stock || null,
            maxPerUser: data.maxPerUser || null,
            enabled: data.enabled ?? true,
            roleTicket: data.hasRoleTicket ? roleTicket : null,
          },
        });
        toast({ title: "아이템 수정 완료", description: "상점 아이템이 수정되었습니다." });
        setEditingItem(null);
      } else {
        await createItem.mutateAsync({
          name: data.name,
          description: data.description,
          price: data.price,
          currencyType: data.currencyType,
          durationDays: data.durationDays ?? 0,
          stock: data.stock,
          maxPerUser: data.maxPerUser,
          enabled: data.enabled ?? true,
          roleTicket,
        });
        toast({ title: "아이템 생성 완료", description: "새 상점 아이템이 추가되었습니다." });
        setIsCreateOpen(false);
      }
      resetForm();
    } catch (error) {
      toast({
        title: "오류 발생",
        description: error instanceof Error ? error.message : "작업 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: ShopItemV2) => {
    setEditingItem(item);

    // Populate pending role options from existing
    if (item.roleTicket?.roleOptions) {
      setPendingRoleOptions(
        item.roleTicket.roleOptions.map((opt, idx) => ({
          tempId: Date.now() + idx,
          name: opt.name,
          roleId: opt.roleId,
          description: opt.description ?? undefined,
        }))
      );
    } else {
      setPendingRoleOptions([]);
    }

    // 효과 지속 기간: 초 -> 일 변환
    const effectDurationDays = item.roleTicket?.effectDurationSeconds
      ? Math.floor(item.roleTicket.effectDurationSeconds / (24 * 60 * 60))
      : 0;

    form.reset({
      name: item.name,
      description: item.description || "",
      price: item.price,
      currencyType: item.currencyType,
      durationDays: item.durationDays || 0,
      stock: item.stock || undefined,
      maxPerUser: item.maxPerUser || undefined,
      enabled: item.enabled,
      hasRoleTicket: !!item.roleTicket,
      consumeQuantity: item.roleTicket?.consumeQuantity ?? 1,
      removePreviousRole: item.roleTicket?.removePreviousRole ?? true,
      effectDurationDays,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말로 이 아이템을 삭제하시겠습니까? 연결된 역할선택권도 함께 삭제됩니다.")) return;
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

  const handleToggleEnabled = async (item: ShopItemV2) => {
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

  const handleCreatePanel = async () => {
    if (!selectedChannelId) {
      toast({ title: "채널을 선택해주세요.", variant: "destructive" });
      return;
    }

    try {
      await createPanelMutation.mutateAsync(selectedChannelId);
      toast({ title: "상점 패널이 설치되었습니다!" });
    } catch {
      toast({ title: "패널 설치에 실패했습니다.", variant: "destructive" });
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Basic Fields */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">아이템 이름</FormLabel>
              <FormControl>
                <Input
                  placeholder="색상선택권"
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">설명 (선택)</FormLabel>
              <FormControl>
                <Input
                  placeholder="닉네임 색상을 변경할 수 있는 티켓"
                  {...field}
                  className="bg-white/5 border-white/10 text-white"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    min={0}
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
                    <SelectItem value="topy">{topyName}</SelectItem>
                    <SelectItem value="ruby">{rubyName}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="durationDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">유효 기간 (일)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  {...field}
                  value={field.value || ""}
                  className="bg-white/5 border-white/10 text-white"
                />
              </FormControl>
              <FormDescription className="text-xs text-white/40">
                0 = 영구, 양수 = 기간제 (일 단위)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">재고</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
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
            name="maxPerUser"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70">유저당 최대</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
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
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl bg-white/5 p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-white">활성화</FormLabel>
                <FormDescription className="text-xs text-white/40">
                  비활성화하면 상점에서 구매할 수 없습니다
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Role Ticket Section */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <FormField
            control={form.control}
            name="hasRoleTicket"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-white flex items-center gap-2">
                    <Icon icon="solar:ticket-bold" className="h-4 w-4 text-purple-400" />
                    역할선택권
                  </FormLabel>
                  <FormDescription className="text-xs text-white/40">
                    이 아이템을 역할 교환권으로 사용합니다
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {hasRoleTicket && (
            <div className="mt-4 space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="consumeQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">소모 개수</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        0 = 기간제 (소모 없음)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effectDurationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">효과 지속 (일)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={field.value || ""}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        0 = 영구, 양수 = 기간제
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="removePreviousRole"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-white/70">이전 역할 제거</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2 h-10">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                          <span className="text-sm text-white/50">
                            {field.value ? "ON" : "OFF"}
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        역할 변경 시 이전 역할 제거
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Role Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Icon icon="solar:users-group-rounded-linear" className="h-4 w-4" />
                  교환 가능 역할 ({pendingRoleOptions.length}개)
                </h4>

                {/* Role options list */}
                {pendingRoleOptions.length > 0 && (
                  <div className="space-y-2">
                    {pendingRoleOptions.map((opt) => {
                      const role = roles?.find((r) => r.id === opt.roleId);
                      return (
                        <div
                          key={opt.tempId}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {role && (
                              <div
                                className="w-6 h-6 rounded-lg"
                                style={{
                                  backgroundColor: `#${role.color.toString(16).padStart(6, "0")}`,
                                }}
                              />
                            )}
                            <div>
                              <span className="text-white font-medium">{opt.name}</span>
                              {opt.description && (
                                <span className="text-white/40 ml-2 text-sm">
                                  - {opt.description}
                                </span>
                              )}
                            </div>
                            <Icon icon="solar:arrow-right-linear" className="h-4 w-4 text-white/30" />
                            <span className="text-white/70">@{role?.name ?? opt.roleId}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRoleOption(opt.tempId)}
                          >
                            <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add role option form */}
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="표시 이름"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <Select value={newRoleId} onValueChange={setNewRoleId}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="역할 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: `#${role.color.toString(16).padStart(6, "0")}`,
                              }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddRoleOption}
                    className="bg-white/10"
                  >
                    <Icon icon="solar:add-circle-linear" className="h-4 w-4 mr-1" />
                    추가
                  </Button>
                </div>
                <Input
                  placeholder="역할 설명 (선택)"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingItem(null);
              resetForm();
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
          <p className="text-white/50 mt-1">
            상점에서 판매할 티켓 아이템을 관리합니다
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-amber-600 to-orange-600">
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              아이템 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">새 상점 아이템 추가</DialogTitle>
            </DialogHeader>
            {formContent}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="bg-zinc-900 border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">아이템 수정</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      {/* 상점 수수료 설정 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Icon icon="solar:tag-price-linear" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">상점 수수료</h3>
            <p className="text-white/50 text-sm">상점 구매 시 부과되는 수수료</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="text-white/70 text-sm block mb-2">{topyName} 상점 수수료 (%)</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={shopFeeTopy}
              onChange={(e) => setShopFeeTopy(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-pink-500/50"
            />
            <p className="text-xs text-white/40 mt-1">{topyName}로 상점 구매 시 부과되는 수수료</p>
          </div>
          <div>
            <label className="text-white/70 text-sm block mb-2">{rubyName} 상점 수수료 (%)</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={shopFeeRuby}
              onChange={(e) => setShopFeeRuby(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-pink-500/50"
            />
            <p className="text-xs text-white/40 mt-1">{rubyName}로 상점 구매 시 부과되는 수수료</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3 flex-1 mr-4">
            <div className="flex items-start gap-2">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-pink-300/70">
                수수료는 상품 가격에 추가로 부과됩니다. 0%로 설정하면 수수료가 부과되지 않습니다.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveFee}
            disabled={updateSettings.isPending}
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
          >
            {updateSettings.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* Panel Setup */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Icon icon="solar:widget-add-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">상점 패널 설치</h3>
            <p className="text-white/50 text-sm">디스코드 채널에 상점 패널을 설치합니다</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedChannelId}
            onValueChange={setSelectedChannelId}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white sm:w-64">
              <SelectValue placeholder="채널 선택..." />
            </SelectTrigger>
            <SelectContent>
              {channels?.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  # {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleCreatePanel}
            disabled={!selectedChannelId || createPanelMutation.isPending}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {createPanelMutation.isPending ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                설치 중...
              </>
            ) : settings?.shopChannelId === selectedChannelId && settings?.shopMessageId ? (
              <>
                <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2" />
                패널 갱신
              </>
            ) : (
              <>
                <Icon icon="solar:add-circle-bold" className="h-4 w-4 mr-2" />
                패널 설치
              </>
            )}
          </Button>
        </div>
        <p className="text-white/40 text-xs mt-2">
          {settings?.shopChannelId && settings?.shopMessageId
            ? "패널이 설치되어 있습니다. 다른 채널을 선택하면 기존 패널은 삭제됩니다."
            : "선택한 채널에 상점 패널 메시지가 생성됩니다. 유저가 버튼을 눌러 상점을 이용할 수 있습니다."}
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:info-circle-linear" className="h-5 w-5 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-white">상점 안내</h3>
            <ul className="text-sm text-white/60 space-y-1">
              <li>• 상점에서는 <strong className="text-white/80">티켓</strong>을 판매합니다</li>
              <li>• <strong className="text-white/80">역할선택권</strong>을 활성화하면 티켓을 역할 교환에 사용할 수 있습니다</li>
              <li>• 유효기간이 0이면 영구, 양수이면 기간제입니다</li>
              <li>• 소모 개수가 0이면 기간 내 무제한 변경 가능합니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Icon icon="solar:shop-linear" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">상점 아이템</h3>
              <p className="text-white/50 text-sm">{items?.length || 0}개의 아이템</p>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{item.name}</span>
                      <Badge
                        variant={item.enabled ? "default" : "secondary"}
                        className={
                          item.enabled
                            ? "bg-green-500/20 text-green-400 border-0"
                            : "bg-red-500/20 text-red-400 border-0"
                        }
                      >
                        {item.enabled ? "활성" : "비활성"}
                      </Badge>
                      {item.roleTicket && (
                        <Badge
                          variant="secondary"
                          className="bg-purple-500/20 text-purple-400 border-0"
                        >
                          <Icon icon="solar:ticket-linear" className="h-3 w-3 mr-1" />
                          역할선택권 ({item.roleTicket.roleOptions.length}개 역할)
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/50 mt-1">
                      <span>
                        {item.price.toLocaleString()}{" "}
                        {item.currencyType === "topy" ? topyName : rubyName}
                      </span>
                      <span>•</span>
                      <span>
                        {item.durationDays === 0 ? "영구" : `${item.durationDays}일`}
                      </span>
                      {item.stock !== null && (
                        <>
                          <span>•</span>
                          <span>재고: {item.stock}</span>
                        </>
                      )}
                      {item.roleTicket && (
                        <>
                          <span>•</span>
                          <span>
                            {item.roleTicket.consumeQuantity === 0
                              ? "기간제"
                              : `${item.roleTicket.consumeQuantity}개 소모`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={() => handleToggleEnabled(item)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                    <Icon icon="solar:pen-linear" className="h-4 w-4 text-white/50" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                    <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Icon icon="solar:bag-smile-linear" className="h-12 w-12 text-white/20 mx-auto mb-4" />
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
