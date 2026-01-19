"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
  useSeedDefaultItems,
  useDefaultItems,
} from "@/hooks/queries";
import type { ItemType } from "@/types/shop-v2";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// 아이템 타입별 한글 라벨
const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  custom: "일반",
  warning_reduction: "경고차감권",
  tax_exemption: "세금감면권",
  transfer_fee_reduction: "이체수수료감면권",
  activity_boost: "활동부스트권",
  premium_afk: "프리미엄잠수방",
  vip_lounge: "VIP라운지",
  vault_subscription: "금고 등급",
  color_basic: "색상선택권(기본)",
  color_premium: "색상선택권(프리미엄)",
};

// 시스템 아이템 타입인지 확인
function isSystemItemType(itemType: ItemType): boolean {
  return itemType !== "custom";
}

// Pending role option for inline management
interface PendingRoleOption {
  tempId: number;
  name: string;
  roleId: string;
  description?: string;
}

// 선택 가능한 아이템 타입
const SELECTABLE_ITEM_TYPES = ["custom", "tax_exemption", "transfer_fee_reduction", "vault_subscription"] as const;
type SelectableItemType = (typeof SELECTABLE_ITEM_TYPES)[number];

const SELECTABLE_ITEM_TYPE_LABELS: Record<SelectableItemType, string> = {
  custom: "일반",
  tax_exemption: "세금감면권",
  transfer_fee_reduction: "이체수수료감면권",
  vault_subscription: "금고 등급",
};

// 역할선택권 프리셋 타입
const ROLE_TICKET_PRESETS = ["once", "period"] as const;
type RoleTicketPreset = (typeof ROLE_TICKET_PRESETS)[number];

const ROLE_TICKET_PRESET_INFO: Record<RoleTicketPreset, { label: string; description: string }> = {
  once: {
    label: "1회 사용권",
    description: "한 번 사용하면 역할이 기간제한 없이 유지됩니다",
  },
  period: {
    label: "기간권",
    description: "유효기간 동안 자유롭게 변경, 만료 시 역할 제거",
  },
};

const shopItemFormSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요").max(100),
  description: z.string().max(500).optional(),
  itemType: z.enum(SELECTABLE_ITEM_TYPES).optional(), // 아이템 타입
  topyPrice: z.coerce.number().min(0, "가격은 0 이상이어야 합니다").optional(),
  rubyPrice: z.coerce.number().min(0, "가격은 0 이상이어야 합니다").optional(),
  currencyType: z.enum(["topy", "ruby", "both"]),
  effectPercent: z.coerce.number().min(1).max(100).optional(), // 효과 비율 (세금면제권, 이체감면권)
  // 금고 등급 설정 (vault_subscription)
  tierName: z.string().max(50).optional(), // 표시용 등급명
  vaultLimit: z.coerce.number().min(0).optional(), // 금고 한도
  monthlyInterestRate: z.coerce.number().min(0).max(100).optional(), // 월 이자율 (%)
  minDepositDays: z.coerce.number().min(0).optional(), // 최소 예치 기간
  transferFeeExempt: z.boolean().optional(), // 이체 수수료 면제
  purchaseFeePercent: z.coerce.number().min(0).max(100).optional(), // 구매 수수료율
  durationDays: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().min(0).optional(),
  maxPerUser: z.coerce.number().min(1).optional(),
  enabled: z.boolean().optional(),
  // Role ticket toggle
  hasRoleTicket: z.boolean().optional(),
  roleTicketPreset: z.enum(ROLE_TICKET_PRESETS).optional(), // 프리셋 선택
  consumeQuantity: z.coerce.number().min(0).optional(),
  removePreviousRole: z.boolean().optional(),
  fixedRoleId: z.string().optional(), // 고정 역할 ID
});

type ShopItemFormValues = z.infer<typeof shopItemFormSchema>;

export default function ShopV2Page() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItemV2 | null>(null);
  const itemListRef = useRef<HTMLDivElement>(null);

  // 기본 아이템 추가 모달 상태
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [selectedDefaultItems, setSelectedDefaultItems] = useState<string[]>([]);

  // 역할 미설정 경고 모달 상태
  const [roleWarningOpen, setRoleWarningOpen] = useState(false);

  // Pending role options for new item creation
  const [pendingRoleOptions, setPendingRoleOptions] = useState<PendingRoleOption[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  // Panel settings - unified shop panel
  const [shopChannelId, setShopChannelId] = useState("");

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
  const createShopPanelMutation = useCreateShopPanel(guildId);
  const seedDefaultItems = useSeedDefaultItems(guildId);
  const { data: defaultItemsData, refetch: refetchDefaultItems } = useDefaultItems(guildId, isSeedModalOpen);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";

  // 설치된 채널이 있으면 초기값으로 설정
  useEffect(() => {
    if (settings?.shopChannelId) {
      setShopChannelId(settings.shopChannelId);
    }
  }, [settings]);

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
      itemType: "custom",
      topyPrice: 0,
      rubyPrice: 0,
      currencyType: "topy",
      effectPercent: 100,
      tierName: "실버",
      vaultLimit: 100000,
      monthlyInterestRate: 1,
      minDepositDays: 7,
      transferFeeExempt: true,
      purchaseFeePercent: 1.2,
      durationDays: 30,
      stock: undefined,
      maxPerUser: undefined,
      enabled: true,
      hasRoleTicket: false,
      roleTicketPreset: "once",
      consumeQuantity: 1,
      removePreviousRole: true,
      fixedRoleId: "__none__",
    },
  });

  const hasRoleTicket = form.watch("hasRoleTicket");
  const roleTicketPreset = form.watch("roleTicketPreset");
  const currencyType = form.watch("currencyType");
  const itemType = form.watch("itemType");

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
      // 프리셋에 따라 consumeQuantity 설정, effectDurationSeconds는 항상 null (아이템 만료 = 역할 만료)
      let consumeQuantity = 1;

      if (data.roleTicketPreset === "once") {
        // 1회 사용권: 1개 소모, 역할 영구 유지
        consumeQuantity = 1;
      } else if (data.roleTicketPreset === "period") {
        // 기간권: 소모 없음, 아이템 만료까지 유지
        consumeQuantity = 0;
      }

      const roleTicket = data.hasRoleTicket
        ? {
            consumeQuantity,
            removePreviousRole: data.removePreviousRole ?? true,
            fixedRoleId: data.fixedRoleId && data.fixedRoleId !== "__none__" ? data.fixedRoleId : null,
            effectDurationSeconds: null, // 항상 null - 아이템 만료 시 역할도 만료
            roleOptions,
          }
        : undefined;

      // 화폐 타입에 따라 가격 설정
      const topyPrice = data.currencyType === "ruby" ? null : data.topyPrice ?? 0;
      const rubyPrice = data.currencyType === "topy" ? null : data.rubyPrice ?? 0;

      // 효과 비율 (세금면제권, 이체감면권일 때만 적용)
      const effectPercent = data.effectPercent && data.effectPercent !== 100 ? data.effectPercent : null;

      // 효과 설정 (금고 등급일 때만 적용)
      const effectConfig = (data.itemType === "vault_subscription")
        ? {
            tierName: data.tierName || "실버",
            vaultLimit: data.vaultLimit ?? 100000,
            monthlyInterestRate: data.monthlyInterestRate ?? 1,
            minDepositDays: data.minDepositDays ?? 7,
            transferFeeExempt: data.transferFeeExempt ?? true,
            purchaseFeePercent: data.purchaseFeePercent ?? 1.2,
          }
        : null;

      // 기간 설정: 금고 등급 또는 역할선택권(기간권)일 때 durationDays 사용
      const isVaultSubscription = data.itemType === "vault_subscription";
      const isPeriodRoleTicket = data.hasRoleTicket && data.roleTicketPreset === "period";
      const durationDays = (isVaultSubscription || isPeriodRoleTicket) ? (data.durationDays ?? 30) : 0;

      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          data: {
            name: data.name,
            description: data.description || null,
            itemType: data.itemType ?? "custom",
            topyPrice,
            rubyPrice,
            currencyType: data.currencyType,
            effectPercent,
            effectConfig,
            durationDays,
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
          itemType: data.itemType ?? "custom",
          topyPrice,
          rubyPrice,
          currencyType: data.currencyType,
          effectPercent,
          effectConfig,
          durationDays,
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

    // 프리셋 추론: consumeQuantity가 0이면 기간권, 아니면 1회 사용권
    let roleTicketPreset: RoleTicketPreset = "once";
    if (item.roleTicket) {
      roleTicketPreset = item.roleTicket.consumeQuantity === 0 ? "period" : "once";
    }

    // itemType이 선택 가능한 타입인지 확인
    let selectableItemType: SelectableItemType = "custom";
    if (SELECTABLE_ITEM_TYPES.includes(item.itemType as SelectableItemType)) {
      selectableItemType = item.itemType as SelectableItemType;
    }

    // effectConfig에서 금고 설정 추출
    const effectConfig = item.effectConfig as {
      tierName?: string;
      vaultLimit?: number;
      monthlyInterestRate?: number;
      minDepositDays?: number;
      transferFeeExempt?: boolean;
      purchaseFeePercent?: number;
    } | null;

    form.reset({
      name: item.name,
      description: item.description || "",
      itemType: selectableItemType,
      topyPrice: item.topyPrice ?? 0,
      rubyPrice: item.rubyPrice ?? 0,
      currencyType: item.currencyType,
      effectPercent: item.effectPercent ?? 100,
      tierName: effectConfig?.tierName ?? "실버",
      vaultLimit: effectConfig?.vaultLimit ?? 100000,
      monthlyInterestRate: effectConfig?.monthlyInterestRate ?? 1,
      minDepositDays: effectConfig?.minDepositDays ?? 7,
      transferFeeExempt: effectConfig?.transferFeeExempt ?? true,
      purchaseFeePercent: effectConfig?.purchaseFeePercent ?? 1.2,
      durationDays: item.durationDays || 30,
      stock: item.stock || undefined,
      maxPerUser: item.maxPerUser || undefined,
      enabled: item.enabled,
      hasRoleTicket: !!item.roleTicket,
      roleTicketPreset,
      consumeQuantity: item.roleTicket?.consumeQuantity ?? 1,
      removePreviousRole: item.roleTicket?.removePreviousRole ?? true,
      fixedRoleId: item.roleTicket?.fixedRoleId || "__none__",
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
    // 역할지급형 아이템을 활성화하려 할 때 역할이 설정되지 않았으면 막기
    if (!item.enabled && item.roleTicket) {
      const hasRoles = (item.roleTicket.roleOptions?.length ?? 0) > 0 || item.roleTicket.fixedRoleId;
      if (!hasRoles) {
        setRoleWarningOpen(true);
        return;
      }
    }

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

  const handleCreateShopPanel = async () => {
    if (!shopChannelId) {
      toast({ title: "채널을 선택해주세요.", variant: "destructive" });
      return;
    }

    try {
      await createShopPanelMutation.mutateAsync(shopChannelId);
      toast({ title: "통합 상점 패널이 설치되었습니다!" });
    } catch {
      toast({ title: "패널 설치에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleOpenSeedModal = () => {
    setSelectedDefaultItems([]);
    setIsSeedModalOpen(true);
    refetchDefaultItems();
  };

  const handleToggleDefaultItem = (itemType: string) => {
    setSelectedDefaultItems((prev) =>
      prev.includes(itemType)
        ? prev.filter((t) => t !== itemType)
        : [...prev, itemType]
    );
  };

  const handleSeedDefaultItems = async () => {
    if (selectedDefaultItems.length === 0) {
      toast({
        title: "아이템을 선택해주세요",
        description: "추가할 아이템을 하나 이상 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await seedDefaultItems.mutateAsync(selectedDefaultItems);
      if (result.seeded > 0) {
        toast({
          title: "기본 아이템 추가 완료",
          description: `${result.seeded}개의 아이템이 추가되었습니다.`,
        });
        setIsSeedModalOpen(false);
        setSelectedDefaultItems([]);
        // 아이템 목록으로 스크롤 이동
        setTimeout(() => {
          itemListRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      } else {
        toast({
          title: "추가할 아이템 없음",
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        title: "기본 아이템 추가 실패",
        description: error instanceof Error ? error.message : "오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 패널 설정 가져오기
  const shopPanel = settings ? {
    channelId: settings.shopChannelId,
    messageId: settings.shopMessageId,
  } : null;

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
          name="itemType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white/70">아이템 타입</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || "custom"}>
                <FormControl>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SELECTABLE_ITEM_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {SELECTABLE_ITEM_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="text-xs text-white/40">
                세금면제권/이체수수료감면권은 효과 비율을 설정할 수 있습니다
              </FormDescription>
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
                  {settings?.topyManagerEnabled !== false && (
                    <SelectItem value="topy">{topyName}</SelectItem>
                  )}
                  {settings?.rubyManagerEnabled !== false && (
                    <SelectItem value="ruby">{rubyName}</SelectItem>
                  )}
                  {settings?.topyManagerEnabled !== false && settings?.rubyManagerEnabled !== false && (
                    <SelectItem value="both">둘 다</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormDescription className="text-xs text-white/40">
                {settings?.topyManagerEnabled === false && settings?.rubyManagerEnabled === false
                  ? "모든 화폐가 비활성화되어 있습니다"
                  : "&quot;둘 다&quot;를 선택하면 두 상점 패널 모두에 표시됩니다"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 가격 필드 - 화폐 타입에 따라 조건부 표시 */}
        <div className="grid grid-cols-2 gap-4">
          {(currencyType === "topy" || currencyType === "both") && (
            <FormField
              control={form.control}
              name="topyPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 flex items-center gap-2">
                    <Icon icon="solar:coin-linear" className="h-4 w-4 text-amber-400" />
                    {topyName} 가격
                  </FormLabel>
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
          )}

          {(currencyType === "ruby" || currencyType === "both") && (
            <FormField
              control={form.control}
              name="rubyPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 flex items-center gap-2">
                    <Icon icon="solar:star-linear" className="h-4 w-4 text-pink-400" />
                    {rubyName} 가격
                  </FormLabel>
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
          )}
        </div>

        {/* 효과 비율 - 세금면제권, 이체감면권일 때만 표시 */}
        {(itemType === "tax_exemption" || itemType === "transfer_fee_reduction") && (
          <FormField
            control={form.control}
            name="effectPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white/70 flex items-center gap-2">
                  <Icon icon="solar:percent-linear" className="h-4 w-4 text-cyan-400" />
                  {itemType === "tax_exemption" ? "세금 감면 비율" : "수수료 감면 비율"} (%)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="100"
                    {...field}
                    value={field.value || 100}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </FormControl>
                <FormDescription className="text-xs text-white/40">
                  {itemType === "tax_exemption"
                    ? "세금의 몇 %를 면제할지 설정합니다 (100% = 전액 면제)"
                    : "수수료의 몇 %를 감면할지 설정합니다 (100% = 전액 면제)"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 금고 등급 설정 - vault_subscription일 때만 표시 */}
        {itemType === "vault_subscription" && (
          <div className="space-y-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
            <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
              <Icon icon="solar:safe-square-bold" className="h-4 w-4 text-amber-400" />
              금고 등급 설정
            </h4>

            {/* 등급명 */}
            <FormField
              control={form.control}
              name="tierName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70">등급명</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="실버, 골드, 플래티넘 등"
                      {...field}
                      value={field.value || ""}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </FormControl>
                  <FormDescription className="text-xs text-white/40">
                    유저에게 표시되는 등급 이름
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 기본 설정 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vaultLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">금고 한도</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="100000"
                        {...field}
                        value={field.value || ""}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      금고에 보관 가능한 최대 금액
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyInterestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">월 이자율 (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="1"
                        {...field}
                        value={field.value || ""}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      매월 지급되는 이자율
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minDepositDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">최소 예치 기간 (일)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="7"
                        {...field}
                        value={field.value ?? ""}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      이자를 받기 위한 최소 예치 기간
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">구독 기간 (일)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="30"
                        {...field}
                        value={field.value || ""}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      구매 시 적용되는 구독 기간
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 수수료 설정 */}
            <h5 className="text-xs font-medium text-white/50 mt-4">수수료 혜택</h5>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transferFeeExempt"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-white/70 text-sm">이체수수료 면제</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseFeePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">구매수수료 (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder="1.2"
                        {...field}
                        value={field.value ?? ""}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      0 = 면제
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>
          </div>
        )}

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
              {/* 프리셋 선택 */}
              <FormField
                control={form.control}
                name="roleTicketPreset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      <Icon icon="solar:widget-bold" className="h-4 w-4 text-purple-400" />
                      사용 방식
                    </FormLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {ROLE_TICKET_PRESETS.map((preset) => (
                        <label
                          key={preset}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            field.value === preset
                              ? "bg-purple-500/20 border-purple-500/50"
                              : "bg-white/5 border-white/10 hover:border-white/20"
                          }`}
                        >
                          <input
                            type="radio"
                            name="roleTicketPreset"
                            value={preset}
                            checked={field.value === preset}
                            onChange={() => field.onChange(preset)}
                            className="sr-only"
                          />
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              field.value === preset
                                ? "border-purple-400 bg-purple-400"
                                : "border-white/30"
                            }`}
                          >
                            {field.value === preset && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-white font-medium">
                              {ROLE_TICKET_PRESET_INFO[preset].label}
                            </div>
                            <div className="text-xs text-white/50">
                              {ROLE_TICKET_PRESET_INFO[preset].description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 유효 기간 - 기간권 선택 시에만 표시 */}
              {roleTicketPreset === "period" && (
                <FormField
                  control={form.control}
                  name="durationDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 flex items-center gap-2">
                        <Icon icon="solar:calendar-bold" className="h-4 w-4 text-cyan-400" />
                        유효 기간 (일)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="30"
                          {...field}
                          value={field.value || ""}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        기간권의 유효 기간을 설정합니다. 만료 시 역할도 함께 제거됩니다.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* 고정 역할 선택 */}
              <FormField
                control={form.control}
                name="fixedRoleId"
                render={({ field }) => {
                  const selectedRole = roles?.find((r) => r.id === field.value);
                  return (
                    <FormItem>
                      <FormLabel className="text-white/70 flex items-center gap-2">
                        <Icon icon="solar:lock-bold" className="h-4 w-4 text-amber-400" />
                        고정 역할 (선택)
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder="고정 역할 선택 (선택사항)">
                              {selectedRole && (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor: `#${selectedRole.color.toString(16).padStart(6, "0")}`,
                                    }}
                                  />
                                  {selectedRole.name}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">없음</SelectItem>
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
                      <FormDescription className="text-xs text-white/40">
                        교환 역할과 함께 부여되는 메인 역할. 만료 시 모든 역할 제거됨
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* 이전 역할 제거 - 프리셋과 무관하게 항상 표시 */}
              <FormField
                control={form.control}
                name="removePreviousRole"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-white/70">이전 역할 제거</FormLabel>
                      <FormDescription className="text-xs text-white/40">
                        역할 변경 시 이전 역할 제거
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleOpenSeedModal}
            className="border-white/20 text-white/70 hover:bg-white/10"
          >
            <Icon icon="solar:box-minimalistic-linear" className="mr-2 h-4 w-4" />
            기본 아이템 추가
          </Button>

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

      {/* Default Items Seed Modal */}
      <Dialog open={isSeedModalOpen} onOpenChange={setIsSeedModalOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">기본 아이템 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 인벤토리형 */}
            <div>
              <h4 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <Icon icon="solar:box-bold" className="h-4 w-4 text-blue-400" />
                인벤토리형 (소모성)
              </h4>
              <div className="space-y-2">
                {defaultItemsData?.items
                  .filter((item) => !item.isRoleItem)
                  .map((item) => (
                    <label
                      key={item.itemType}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        item.alreadyExists
                          ? "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                          : selectedDefaultItems.includes(item.itemType)
                          ? "bg-blue-500/20 border-blue-500/50"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDefaultItems.includes(item.itemType)}
                        onChange={() => handleToggleDefaultItem(item.itemType)}
                        disabled={item.alreadyExists}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        item.alreadyExists
                          ? "border-white/20 bg-white/10"
                          : selectedDefaultItems.includes(item.itemType)
                          ? "border-blue-500 bg-blue-500"
                          : "border-white/30"
                      }`}>
                        {(selectedDefaultItems.includes(item.itemType) || item.alreadyExists) && (
                          <Icon icon="solar:check-read-linear" className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{item.name}</div>
                        <div className="text-xs text-white/50">{item.description}</div>
                      </div>
                      {item.alreadyExists && (
                        <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">등록됨</Badge>
                      )}
                    </label>
                  ))}
              </div>
            </div>

            {/* 역할지급형 */}
            <div>
              <h4 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                <Icon icon="solar:ticket-bold" className="h-4 w-4 text-purple-400" />
                역할지급형 (기간제)
              </h4>
              <div className="space-y-2">
                {defaultItemsData?.items
                  .filter((item) => item.isRoleItem)
                  .map((item) => (
                    <label
                      key={item.itemType}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        item.alreadyExists
                          ? "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                          : selectedDefaultItems.includes(item.itemType)
                          ? "bg-purple-500/20 border-purple-500/50"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDefaultItems.includes(item.itemType)}
                        onChange={() => handleToggleDefaultItem(item.itemType)}
                        disabled={item.alreadyExists}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        item.alreadyExists
                          ? "border-white/20 bg-white/10"
                          : selectedDefaultItems.includes(item.itemType)
                          ? "border-purple-500 bg-purple-500"
                          : "border-white/30"
                      }`}>
                        {(selectedDefaultItems.includes(item.itemType) || item.alreadyExists) && (
                          <Icon icon="solar:check-read-linear" className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">
                          {item.name}
                          <span className="ml-2 text-xs text-white/40">{item.durationDays}일</span>
                        </div>
                        <div className="text-xs text-white/50">{item.description}</div>
                      </div>
                      {item.alreadyExists && (
                        <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">등록됨</Badge>
                      )}
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setIsSeedModalOpen(false)}
              >
                취소
              </Button>
              <Button
                onClick={handleSeedDefaultItems}
                disabled={seedDefaultItems.isPending || selectedDefaultItems.length === 0}
                className="bg-gradient-to-r from-amber-600 to-orange-600"
              >
                {seedDefaultItems.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                ) : null}
                선택 항목 추가 ({selectedDefaultItems.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Warning Modal */}
      <AlertDialog open={roleWarningOpen} onOpenChange={setRoleWarningOpen}>
        <AlertDialogContent className="bg-zinc-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold" className="h-5 w-5 text-amber-500" />
              역할을 먼저 설정해주세요
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              역할지급형 아이템은 역할을 설정한 후 활성화할 수 있습니다.
              <br />
              아이템을 수정하여 <strong className="text-white">고정 역할</strong> 또는 <strong className="text-white">선택 역할</strong>을 추가해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-amber-600 hover:bg-amber-700">
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 안내 박스 */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 animate-fade-up">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:lightbulb-bolt-linear" className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-amber-300 font-medium">상점 시스템 안내</p>
            <ul className="text-sm text-amber-300/70 space-y-1 list-disc list-inside">
              <li><strong>아이템</strong>: 유저가 {topyName}/{rubyName}로 구매할 수 있는 티켓을 등록합니다</li>
              <li><strong>역할선택권</strong>: 구매한 티켓으로 역할을 교환할 수 있게 설정합니다 (예: 닉네임 색상 선택)</li>
              <li><strong>패널 설치</strong>: 디스코드 채널에 상점 버튼을 설치하면 유저가 버튼 클릭으로 구매할 수 있습니다</li>
              <li>재고, 유저당 최대 구매 수량, 유효 기간 등을 세부 설정할 수 있습니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Panel Setup - Unified Shop */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Icon icon="solar:widget-add-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">상점 패널 설치</h3>
            <p className="text-white/50 text-sm">디스코드 채널에 통합 상점 패널을 설치합니다</p>
          </div>
        </div>

        {/* 통합 상점 패널 */}
        <div className="bg-white/5 rounded-xl border border-purple-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-medium text-white">🛒 통합 상점</span>
            {shopPanel?.messageId && (
              <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">설치됨</Badge>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={shopChannelId} onValueChange={setShopChannelId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white flex-1">
                <SelectValue placeholder="채널 선택...">
                  {shopChannelId && channels?.find(c => c.id === shopChannelId)
                    ? `# ${channels.find(c => c.id === shopChannelId)?.name}`
                    : shopChannelId
                      ? "로딩 중..."
                      : "채널 선택..."}
                </SelectValue>
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
              onClick={handleCreateShopPanel}
              disabled={!shopChannelId || createShopPanelMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              {createShopPanelMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : shopPanel?.channelId === shopChannelId && shopPanel?.messageId ? (
                <>
                  <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-1" />
                  갱신
                </>
              ) : (
                <>
                  <Icon icon="solar:add-circle-bold" className="h-4 w-4 mr-1" />
                  설치
                </>
              )}
            </Button>
          </div>
          <p className="text-white/40 text-xs mt-2">
            {shopPanel?.messageId
              ? "다른 채널 선택 시 기존 패널 삭제"
              : `${topyName}/${rubyName} 상점을 버튼으로 전환하는 통합 패널`}
          </p>
        </div>
      </div>

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
              <li>• 유효기간이 0이면 기간제한 없음, 양수이면 기간제입니다</li>
              <li>• 소모 개수가 0이면 기간 내 무제한 변경 가능합니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div ref={itemListRef} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
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
            {/* 정렬: 토피 → 루비 → 둘다, 각 그룹 내에서 활성화 → 비활성화 */}
            {(() => {
              const currencyOrder = { topy: 0, ruby: 1, both: 2 };
              const sortedItems = [...items].sort((a, b) => {
                // 1. 화폐 종류 순서
                const currencyDiff = currencyOrder[a.currencyType] - currencyOrder[b.currencyType];
                if (currencyDiff !== 0) return currencyDiff;
                // 2. 활성화 상태 (활성화된 것이 먼저)
                if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
                // 3. 이름순
                return a.name.localeCompare(b.name, 'ko');
              });

              // 그룹별로 분류
              type CurrencyType = 'topy' | 'ruby' | 'both';
              const groupDefs: { type: CurrencyType; label: string; icon: string }[] = [
                { type: 'topy' as const, label: topyName, icon: '💰' },
                { type: 'ruby' as const, label: rubyName, icon: '💎' },
                { type: 'both' as const, label: '공용', icon: '✨' },
              ];
              const groups = groupDefs
                .map(g => ({ ...g, items: sortedItems.filter(i => i.currencyType === g.type) }))
                .filter(g => g.items.length > 0);

              return groups.map((group) => (
                <div key={group.type}>
                  {/* 그룹 헤더 */}
                  <div className={`px-4 py-2 flex items-center gap-2 ${
                    group.type === 'topy' ? 'bg-amber-500/10' :
                    group.type === 'ruby' ? 'bg-pink-500/10' : 'bg-purple-500/10'
                  }`}>
                    <span className="text-lg">{group.icon}</span>
                    <span className={`font-medium text-sm ${
                      group.type === 'topy' ? 'text-amber-400' :
                      group.type === 'ruby' ? 'text-pink-400' : 'text-purple-400'
                    }`}>
                      {group.label} 상점
                    </span>
                    <span className="text-white/40 text-xs">({group.items.length}개)</span>
                  </div>
                  {/* 그룹 아이템 목록 */}
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 flex items-start gap-4 hover:bg-white/5 transition-colors border-l-4 ${
                        item.enabled
                          ? item.currencyType === 'topy'
                            ? 'border-l-amber-500'
                            : item.currencyType === 'ruby'
                            ? 'border-l-pink-500'
                            : 'border-l-purple-500'
                          : 'border-l-white/20'
                      } ${!item.enabled ? 'opacity-50' : ''}`}
                    >
                      {/* 아이템 아이콘 */}
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                          item.currencyType === "topy"
                            ? "bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/30"
                            : item.currencyType === "ruby"
                            ? "bg-gradient-to-br from-pink-500/30 to-rose-500/30 border border-pink-500/30"
                            : "bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/30"
                        }`}
                      >
                        {item.roleTicket ? "🎫" : item.currencyType === "topy" ? "💰" : item.currencyType === "ruby" ? "💎" : "✨"}
                      </div>

                      {/* 아이템 정보 */}
                      <div className="flex-1 min-w-0">
                        {/* 이름 + 뱃지 */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-white font-semibold text-base">{item.name}</span>
                          <Badge
                            className={`text-xs px-2 py-0.5 ${
                              item.enabled
                                ? "bg-green-500/20 text-green-400 border-0"
                                : "bg-red-500/20 text-red-400 border-0"
                            }`}
                          >
                            {item.enabled ? "활성" : "비활성"}
                          </Badge>
                          {item.itemType && isSystemItemType(item.itemType as ItemType) && (
                            <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs px-2 py-0.5">
                              {ITEM_TYPE_LABELS[item.itemType as ItemType] ?? item.itemType}
                            </Badge>
                          )}
                          {item.roleTicket && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs px-2 py-0.5">
                              역할선택권 ({item.roleTicket.roleOptions.length}개 역할)
                            </Badge>
                          )}
                          {item.roleTicket?.fixedRoleId && (
                            <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs px-2 py-0.5">
                              고정 역할
                            </Badge>
                          )}
                        </div>

                        {/* 가격 및 상세 정보 */}
                        <div className="flex items-center gap-2 text-sm text-white/60 flex-wrap">
                          <span className="font-medium">
                            {item.currencyType === "topy" && item.topyPrice !== null && (
                              <span className="text-amber-400">{item.topyPrice.toLocaleString()} {topyName}</span>
                            )}
                            {item.currencyType === "ruby" && item.rubyPrice !== null && (
                              <span className="text-pink-400">{item.rubyPrice.toLocaleString()} {rubyName}</span>
                            )}
                            {item.currencyType === "both" && (
                              <>
                                <span className="text-amber-400">{item.topyPrice?.toLocaleString() ?? 0} {topyName}</span>
                                <span className="text-white/40 mx-1">/</span>
                                <span className="text-pink-400">{item.rubyPrice?.toLocaleString() ?? 0} {rubyName}</span>
                              </>
                            )}
                          </span>
                          <span className="text-white/30">•</span>
                          <span>{item.durationDays === 0 ? "기간제한 없음" : `${item.durationDays}일`}</span>
                          {item.stock !== null && (
                            <>
                              <span className="text-white/30">•</span>
                              <span>재고 {item.stock}</span>
                            </>
                          )}
                          {item.roleTicket && (
                            <>
                              <span className="text-white/30">•</span>
                              <span>
                                {item.roleTicket.consumeQuantity === 0 ? "기간제" : `${item.roleTicket.consumeQuantity}개 소모`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Switch
                          checked={item.enabled}
                          onCheckedChange={() => handleToggleEnabled(item)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} className="h-8 w-8">
                          <Icon icon="solar:pen-linear" className="h-4 w-4 text-white/50" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8">
                          <Icon icon="solar:trash-bin-2-linear" className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
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
