"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCurrencyHotTimes,
  useCreateCurrencyHotTime,
  useUpdateCurrencyHotTime,
  useDeleteCurrencyHotTime,
  useCurrencyExclusions,
  useCreateCurrencyExclusion,
  useDeleteCurrencyExclusion,
  useCurrencyMultipliers,
  useCreateCurrencyMultiplier,
  useUpdateCurrencyMultiplier,
  useDeleteCurrencyMultiplier,
  useChannels,
  useRoles,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { Icon } from "@iconify/react";
import { CurrencyMultiplier } from "@/types/currency";

const typeLabels: Record<string, string> = {
  text: "텍스트",
  voice: "음성",
  all: "전체",
};

const hotTimeSchema = z.object({
  type: z.enum(["text", "voice", "all"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식이어야 합니다"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식이어야 합니다"),
  multiplier: z.coerce.number().min(0).max(10),
  enabled: z.boolean(),
});

// Channel type constants
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_VOICE = 2;
const CHANNEL_TYPE_STAGE_VOICE = 13;

const isVoiceChannel = (type: number) =>
  type === CHANNEL_TYPE_VOICE || type === CHANNEL_TYPE_STAGE_VOICE;

export default function CurrencyRulesPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [activeTab, setActiveTab] = useState("hottime");
  const [isAddingHotTime, setIsAddingHotTime] = useState(false);
  const [isAddingMultiplier, setIsAddingMultiplier] = useState(false);
  const [isAddingExclusion, setIsAddingExclusion] = useState(false);
  const [selectedHotTimeChannels, setSelectedHotTimeChannels] = useState<string[]>([]);

  // Multiplier State
  const [multiplierTargetType, setMultiplierTargetType] = useState<"channel" | "role">("channel");
  const [multiplierTargetIds, setMultiplierTargetIds] = useState<string[]>([]);
  const [multiplierValue, setMultiplierValue] = useState<string>("1");
  const [editedMultipliers, setEditedMultipliers] = useState<Record<number, string>>({});

  // Exclusion State
  const [exclusionTargetType, setExclusionTargetType] = useState<"channel" | "role">("channel");
  const [exclusionTargetIds, setExclusionTargetIds] = useState<string[]>([]);

  // Data queries
  const { data: hotTimes = [], isLoading: hotTimesLoading } = useCurrencyHotTimes(guildId);
  const { data: exclusions = [], isLoading: exclusionsLoading } = useCurrencyExclusions(guildId);
  const { data: multipliers = [], isLoading: multipliersLoading } = useCurrencyMultipliers(guildId);
  const { data: channels = [], isLoading: channelsLoading } = useChannels(guildId);
  const { data: roles = [], isLoading: rolesLoading } = useRoles(guildId);

  // Mutations
  const createHotTime = useCreateCurrencyHotTime(guildId);
  const updateHotTime = useUpdateCurrencyHotTime(guildId);
  const deleteHotTime = useDeleteCurrencyHotTime(guildId);
  const createExclusion = useCreateCurrencyExclusion(guildId);
  const deleteExclusion = useDeleteCurrencyExclusion(guildId);
  const createMultiplier = useCreateCurrencyMultiplier(guildId);
  const updateMultiplier = useUpdateCurrencyMultiplier(guildId);
  const deleteMultiplier = useDeleteCurrencyMultiplier(guildId);

  // Forms
  const hotTimeForm = useForm({
    resolver: zodResolver(hotTimeSchema),
    defaultValues: {
      type: "all" as const,
      startTime: "20:00",
      endTime: "23:00",
      multiplier: 2,
      enabled: true,
    },
  });

  const hotTimeFormIsDirty = hotTimeForm.formState.isDirty;

  // Unsaved changes tracking
  useEffect(() => {
    const hasHotTimeFormData = isAddingHotTime && (hotTimeFormIsDirty || selectedHotTimeChannels.length > 0);
    const hasExclusionFormData = isAddingExclusion && exclusionTargetIds.length > 0;
    const hasMultiplierFormData = isAddingMultiplier && multiplierTargetIds.length > 0;
    const hasEditedMultipliers = Object.keys(editedMultipliers).length > 0;
    setHasUnsavedChanges(hasHotTimeFormData || hasExclusionFormData || hasMultiplierFormData || hasEditedMultipliers);
  }, [isAddingHotTime, hotTimeFormIsDirty, selectedHotTimeChannels, isAddingExclusion, exclusionTargetIds, isAddingMultiplier, multiplierTargetIds, editedMultipliers, setHasUnsavedChanges]);

  // Handlers
  const onSubmitHotTime = async (data: z.infer<typeof hotTimeSchema>) => {
    try {
      await createHotTime.mutateAsync({
        ...data,
        channelIds: selectedHotTimeChannels.length > 0 ? selectedHotTimeChannels : undefined,
      });
      hotTimeForm.reset();
      setSelectedHotTimeChannels([]);
      setIsAddingHotTime(false);
      toast({ title: "핫타임 추가 완료" });
    } catch {
      toast({ title: "추가 실패", variant: "destructive" });
    }
  };

  const handleSubmitMultiplier = async () => {
    if (multiplierTargetIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "채널 또는 역할을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const numValue = parseInt(multiplierValue);
    if (multiplierValue.trim() === "" || isNaN(numValue)) {
      toast({
        title: "입력 필요",
        description: "배율 값을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const targetId of multiplierTargetIds) {
        await createMultiplier.mutateAsync({
          targetType: multiplierTargetType,
          targetId,
          multiplier: numValue,
        });
      }
      toast({
        title: "배율 추가 완료",
        description: `${multiplierTargetIds.length}개의 ${multiplierTargetType === "channel" ? "채널" : "역할"} 배율이 추가되었습니다.`,
      });
      setIsAddingMultiplier(false);
      setMultiplierTargetIds([]);
      setMultiplierValue("1");
    } catch {
      toast({
        title: "추가 실패",
        description: "일부 항목이 이미 존재하거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateMultiplier = async (multiplier: CurrencyMultiplier, newValueStr: string) => {
    const numValue = parseInt(newValueStr);
    if (newValueStr.trim() === "" || isNaN(numValue)) {
      toast({
        title: "입력 필요",
        description: "배율 값을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMultiplier.mutateAsync({
        id: multiplier.id,
        data: { multiplier: numValue },
      });
      setEditedMultipliers((prev) => {
        const next = { ...prev };
        delete next[multiplier.id];
        return next;
      });
      toast({
        title: "배율 수정 완료",
        description: `배율이 ${numValue}x로 변경되었습니다.`,
      });
    } catch {
      toast({
        title: "수정 실패",
        description: "배율을 수정하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMultiplier = async (id: number) => {
    try {
      await deleteMultiplier.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "배율 설정이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "배율을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSubmitExclusion = async () => {
    if (exclusionTargetIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "채널 또는 역할을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const targetId of exclusionTargetIds) {
        await createExclusion.mutateAsync({
          targetType: exclusionTargetType,
          targetId,
        });
      }
      toast({
        title: "차단 추가 완료",
        description: `${exclusionTargetIds.length}개의 ${exclusionTargetType === "channel" ? "채널" : "역할"}이 차단되었습니다.`,
      });
      setIsAddingExclusion(false);
      setExclusionTargetIds([]);
    } catch {
      toast({
        title: "추가 실패",
        description: "일부 항목이 이미 존재하거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExclusion = async (id: number) => {
    try {
      await deleteExclusion.mutateAsync(id);
      toast({ title: "삭제 완료" });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  // Channel/Role options
  const filteredChannels = channels.filter(
    (ch) => ch.type === CHANNEL_TYPE_TEXT || isVoiceChannel(ch.type)
  );

  const existingMultiplierChannelIds = new Set(
    multipliers.filter((m) => m.targetType === "channel").map((m) => m.targetId)
  );
  const existingMultiplierRoleIds = new Set(
    multipliers.filter((m) => m.targetType === "role").map((m) => m.targetId)
  );

  const multiplierChannelOptions: MultiSelectOption[] = filteredChannels
    .filter((ch) => !existingMultiplierChannelIds.has(ch.id))
    .sort((a, b) => {
      const aIsVoice = isVoiceChannel(a.type);
      const bIsVoice = isVoiceChannel(b.type);
      if (aIsVoice && !bIsVoice) return -1;
      if (!aIsVoice && bIsVoice) return 1;
      return 0;
    })
    .map((ch) => ({
      value: ch.id,
      label: ch.name,
      icon: isVoiceChannel(ch.type) ? (
        <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
      ) : (
        <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-slate-400" />
      ),
      group: isVoiceChannel(ch.type) ? "🔊 음성 채널" : "# 텍스트 채널",
    }));

  const multiplierRoleOptions: MultiSelectOption[] = (roles ?? [])
    .filter((r) => !existingMultiplierRoleIds.has(r.id))
    .map((r) => ({
      value: r.id,
      label: r.name,
      color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
    }));

  const existingExclusionChannelIds = new Set(
    exclusions.filter((e) => e.targetType === "channel").map((e) => e.targetId)
  );
  const existingExclusionRoleIds = new Set(
    exclusions.filter((e) => e.targetType === "role").map((e) => e.targetId)
  );

  const exclusionChannelOptions: MultiSelectOption[] = filteredChannels
    .filter((ch) => !existingExclusionChannelIds.has(ch.id))
    .sort((a, b) => {
      const aIsVoice = isVoiceChannel(a.type);
      const bIsVoice = isVoiceChannel(b.type);
      if (aIsVoice && !bIsVoice) return -1;
      if (!aIsVoice && bIsVoice) return 1;
      return 0;
    })
    .map((ch) => ({
      value: ch.id,
      label: ch.name,
      icon: isVoiceChannel(ch.type) ? (
        <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
      ) : (
        <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-slate-400" />
      ),
      group: isVoiceChannel(ch.type) ? "🔊 음성 채널" : "# 텍스트 채널",
    }));

  const exclusionRoleOptions: MultiSelectOption[] = (roles ?? [])
    .filter((r) => !existingExclusionRoleIds.has(r.id))
    .map((r) => ({
      value: r.id,
      label: r.name,
      color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
    }));

  // 핫타임 채널 선택 옵션
  const hotTimeType = hotTimeForm.watch("type");
  const hotTimeChannelOptions: MultiSelectOption[] = filteredChannels
    .filter((ch) => {
      if (hotTimeType === "voice") return isVoiceChannel(ch.type);
      if (hotTimeType === "text") return ch.type === CHANNEL_TYPE_TEXT;
      return true;
    })
    .sort((a, b) => {
      const aIsVoice = isVoiceChannel(a.type);
      const bIsVoice = isVoiceChannel(b.type);
      if (aIsVoice && !bIsVoice) return -1;
      if (!aIsVoice && bIsVoice) return 1;
      return 0;
    })
    .map((ch) => ({
      value: ch.id,
      label: ch.name,
      icon: isVoiceChannel(ch.type) ? (
        <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
      ) : (
        <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-slate-400" />
      ),
      group: isVoiceChannel(ch.type) ? "🔊 음성 채널" : "# 텍스트 채널",
    }));

  // Helper functions
  const getChannel = (id: string) => channels.find((c) => c.id === id);
  const getChannelName = (id: string) => getChannel(id)?.name ?? id;
  const getRoleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  const channelMultipliers = multipliers.filter((m) => m.targetType === "channel");
  const roleMultipliers = multipliers.filter((m) => m.targetType === "role");
  const channelExclusions = exclusions.filter((e) => e.targetType === "channel");
  const roleExclusions = exclusions.filter((e) => e.targetType === "role");

  const isLoading = hotTimesLoading || exclusionsLoading || multipliersLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
        <div className="h-12 w-80 animate-pulse rounded-xl bg-white/5" />
        <div className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">화폐 규칙</h1>
        <p className="text-white/50 mt-1">토피 보너스 및 제한 규칙을 설정합니다.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger
              value="hottime"
              className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
            >
              <Icon icon="solar:fire-linear" className="mr-2 h-4 w-4" />
              핫타임
            </TabsTrigger>
            <TabsTrigger
              value="multipliers"
              className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
            >
              <Icon icon="solar:chart-2-linear" className="mr-2 h-4 w-4" />
              배율
            </TabsTrigger>
            <TabsTrigger
              value="exclusions"
              className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
            >
              <Icon icon="solar:shield-linear" className="mr-2 h-4 w-4" />
              토피 차단
            </TabsTrigger>
          </TabsList>

          {activeTab === "hottime" && (
            <Button
              onClick={() => setIsAddingHotTime(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25"
            >
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              핫타임 추가
            </Button>
          )}

          {activeTab === "multipliers" && (
            <Button
              onClick={() => setIsAddingMultiplier(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25"
            >
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              배율 추가
            </Button>
          )}

          {activeTab === "exclusions" && (
            <Button
              onClick={() => setIsAddingExclusion(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25"
            >
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              차단 추가
            </Button>
          )}
        </div>

        {/* 핫타임 탭 */}
        <TabsContent value="hottime" className="space-y-6 animate-fade-up">
          {/* Add Hot Time Form */}
          {isAddingHotTime && (
            <div className="relative z-20 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/30 animate-fade-up">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-2xl" />
              <div className="relative">
                <h3 className="text-lg font-semibold text-white mb-4">새 핫타임 추가</h3>
                <Form {...hotTimeForm}>
                  <form onSubmit={hotTimeForm.handleSubmit(onSubmitHotTime)} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <FormField
                        control={hotTimeForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">유형</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedHotTimeChannels([]);
                              }}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">전체</SelectItem>
                                <SelectItem value="text">텍스트</SelectItem>
                                <SelectItem value="voice">음성</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hotTimeForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">시작 시간</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hotTimeForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">종료 시간</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hotTimeForm.control}
                        name="multiplier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">배율</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                max="10"
                                {...field}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 적용 채널 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/70 flex items-center gap-1">
                        <Icon icon="solar:hashtag-linear" className="w-4 h-4" />
                        적용 채널
                        <span className="text-white/40 text-xs">(선택)</span>
                      </label>
                      <MultiSelect
                        options={hotTimeChannelOptions}
                        selected={selectedHotTimeChannels}
                        onChange={setSelectedHotTimeChannels}
                        placeholder={channelsLoading ? "로딩 중..." : "채널을 선택하세요 (미선택 시 전체 적용)"}
                        isLoading={channelsLoading}
                      />
                      <p className="text-xs text-white/40">
                        선택하지 않으면 모든 채널에 적용됩니다.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddingHotTime(false);
                          setSelectedHotTimeChannels([]);
                          hotTimeForm.reset();
                        }}
                        className="border-white/10 hover:bg-white/5"
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        disabled={createHotTime.isPending}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
                      >
                        {createHotTime.isPending ? "추가 중..." : "추가"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          )}

          {/* Hot Times List */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Icon icon="solar:fire-bold" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">핫타임 목록</h3>
                  <p className="text-sm text-white/50">특정 시간대에 토피 배율이 증가합니다.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {hotTimes.length > 0 ? (
                <div className="space-y-3">
                  {hotTimes.map((hotTime) => (
                    <div
                      key={hotTime.id}
                      className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                          <Icon icon="solar:fire-linear" className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">
                              {hotTime.startTime} - {hotTime.endTime}
                            </span>
                            <Badge variant="secondary" className="bg-white/10 text-white/70">{typeLabels[hotTime.type]}</Badge>
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">x{hotTime.multiplier}</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-white/40 mt-1">
                            <Icon icon="solar:clock-circle-linear" className="h-3 w-3" />
                            {hotTime.enabled ? "활성화됨" : "비활성화됨"}
                            <span className="mx-1">•</span>
                            <Icon icon="solar:hashtag-linear" className="h-3 w-3" />
                            {hotTime.channelIds && hotTime.channelIds.length > 0 ? (
                              <span>
                                {hotTime.channelIds.slice(0, 2).map(id => getChannelName(id)).join(", ")}
                                {hotTime.channelIds.length > 2 && ` 외 ${hotTime.channelIds.length - 2}개`}
                              </span>
                            ) : (
                              <span>모든 채널</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={hotTime.enabled}
                          onCheckedChange={() => updateHotTime.mutate({ id: hotTime.id, data: { enabled: !hotTime.enabled } })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteHotTime.mutate(hotTime.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:fire-linear" className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/50">설정된 핫타임이 없습니다.</p>
                  <p className="text-sm text-white/30 mt-1">핫타임을 추가하여 특정 시간대에 토피 배율을 높이세요.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 배율 탭 */}
        <TabsContent value="multipliers" className="space-y-6 animate-fade-up">
          <div className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-sm text-amber-200/80">
              <strong className="text-amber-200">배율 적용:</strong> 역할/채널 구분 없이 가장 높은 배율이 적용됩니다.
            </p>
          </div>

          {/* Add Multiplier Form */}
          {isAddingMultiplier && (
            <div className="relative z-20 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/30 animate-fade-up">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-2xl -z-10" />

              <div className="relative space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">새 배율 추가</h3>
                  <p className="text-sm text-white/50">특정 채널이나 역할에 토피 배율을 설정합니다.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">유형</label>
                    <Select
                      value={multiplierTargetType}
                      onValueChange={(value: "channel" | "role") => {
                        setMultiplierTargetType(value);
                        setMultiplierTargetIds([]);
                      }}
                    >
                      <SelectTrigger className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="channel">채널</SelectItem>
                        <SelectItem value="role">역할</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">
                      {multiplierTargetType === "channel" ? "채널 선택" : "역할 선택"}
                    </label>
                    <MultiSelect
                      options={multiplierTargetType === "channel" ? multiplierChannelOptions : multiplierRoleOptions}
                      selected={multiplierTargetIds}
                      onChange={setMultiplierTargetIds}
                      placeholder={
                        multiplierTargetType === "channel"
                          ? channelsLoading
                            ? "로딩 중..."
                            : "채널을 선택하세요"
                          : rolesLoading
                          ? "로딩 중..."
                          : "역할을 선택하세요"
                      }
                      isLoading={multiplierTargetType === "channel" ? channelsLoading : rolesLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70 flex items-center gap-1">
                      <Icon icon="solar:chart-2-linear" className="w-4 h-4" />
                      배율
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="10"
                      value={multiplierValue}
                      onChange={(e) => setMultiplierValue(e.target.value)}
                      className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingMultiplier(false);
                      setMultiplierTargetIds([]);
                      setMultiplierValue("1");
                    }}
                    className="border-white/10 hover:bg-white/5"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSubmitMultiplier}
                    disabled={createMultiplier.isPending || multiplierTargetIds.length === 0}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
                  >
                    {createMultiplier.isPending
                      ? "추가 중..."
                      : multiplierTargetIds.length > 0
                      ? `${multiplierTargetIds.length}개 추가`
                      : "추가"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Multipliers Lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Channel Multipliers */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Icon icon="solar:hashtag-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">채널별 배율</h3>
                    <p className="text-sm text-white/50">특정 채널에서 토피 배율이 적용됩니다.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {channelMultipliers.length > 0 ? (
                  <div className="space-y-2">
                    {channelMultipliers.map((multiplier) => {
                      const channel = getChannel(multiplier.targetId);
                      const isVoice = channel ? isVoiceChannel(channel.type) : false;
                      return (
                        <div
                          key={multiplier.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            {isVoice ? (
                              <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
                            ) : (
                              <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-white/40" />
                            )}
                            <span className="text-white/80">
                              {getChannelName(multiplier.targetId)}
                            </span>
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">x{multiplier.multiplier}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              max="10"
                              value={editedMultipliers[multiplier.id] ?? String(multiplier.multiplier)}
                              className="w-20 border-white/10 bg-white/5"
                              onChange={(e) => {
                                setEditedMultipliers((prev) => ({
                                  ...prev,
                                  [multiplier.id]: e.target.value,
                                }));
                              }}
                            />
                            {editedMultipliers[multiplier.id] !== undefined &&
                              editedMultipliers[multiplier.id] !== String(multiplier.multiplier) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUpdateMultiplier(multiplier, editedMultipliers[multiplier.id])}
                                disabled={updateMultiplier.isPending}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              >
                                <Icon icon="solar:check-circle-linear" className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMultiplier(multiplier.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Icon icon="solar:hashtag-linear" className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/40">채널 배율이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Role Multipliers */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Icon icon="solar:shield-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">역할별 배율</h3>
                    <p className="text-sm text-white/50">특정 역할을 가진 유저에게 토피 배율이 적용됩니다.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {roleMultipliers.length > 0 ? (
                  <div className="space-y-2">
                    {roleMultipliers.map((multiplier) => (
                      <div
                        key={multiplier.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">@{getRoleName(multiplier.targetId)}</Badge>
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">x{multiplier.multiplier}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max="10"
                            value={editedMultipliers[multiplier.id] ?? String(multiplier.multiplier)}
                            className="w-20 border-white/10 bg-white/5"
                            onChange={(e) => {
                              setEditedMultipliers((prev) => ({
                                ...prev,
                                [multiplier.id]: e.target.value,
                              }));
                            }}
                          />
                          {editedMultipliers[multiplier.id] !== undefined &&
                            editedMultipliers[multiplier.id] !== String(multiplier.multiplier) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUpdateMultiplier(multiplier, editedMultipliers[multiplier.id])}
                              disabled={updateMultiplier.isPending}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            >
                              <Icon icon="solar:check-circle-linear" className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMultiplier(multiplier.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Icon icon="solar:shield-linear" className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/40">역할 배율이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 토피 차단 탭 */}
        <TabsContent value="exclusions" className="space-y-6 animate-fade-up">
          {/* Add Exclusion Form */}
          {isAddingExclusion && (
            <div className="relative z-20 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-amber-500/30 animate-fade-up">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-2xl -z-10" />

              <div className="relative space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">새 차단 항목 추가</h3>
                  <p className="text-sm text-white/50">차단할 채널 또는 역할을 여러 개 선택할 수 있습니다.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">유형</label>
                    <Select
                      value={exclusionTargetType}
                      onValueChange={(value: "channel" | "role") => {
                        setExclusionTargetType(value);
                        setExclusionTargetIds([]);
                      }}
                    >
                      <SelectTrigger className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="channel">채널</SelectItem>
                        <SelectItem value="role">역할</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">
                      {exclusionTargetType === "channel" ? "채널 선택" : "역할 선택"}
                    </label>
                    <MultiSelect
                      options={exclusionTargetType === "channel" ? exclusionChannelOptions : exclusionRoleOptions}
                      selected={exclusionTargetIds}
                      onChange={setExclusionTargetIds}
                      placeholder={
                        exclusionTargetType === "channel"
                          ? channelsLoading
                            ? "로딩 중..."
                            : "채널을 선택하세요"
                          : rolesLoading
                          ? "로딩 중..."
                          : "역할을 선택하세요"
                      }
                      isLoading={exclusionTargetType === "channel" ? channelsLoading : rolesLoading}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingExclusion(false);
                      setExclusionTargetIds([]);
                    }}
                    className="border-white/10 hover:bg-white/5"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSubmitExclusion}
                    disabled={createExclusion.isPending || exclusionTargetIds.length === 0}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
                  >
                    {createExclusion.isPending
                      ? "추가 중..."
                      : exclusionTargetIds.length > 0
                      ? `${exclusionTargetIds.length}개 추가`
                      : "추가"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Exclusions Lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Channel Exclusions */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                    <Icon icon="solar:forbidden-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">차단된 채널</h3>
                    <p className="text-sm text-white/50">이 채널에서는 토피를 받을 수 없습니다.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {channelExclusions.length > 0 ? (
                  <div className="space-y-2">
                    {channelExclusions.map((exclusion) => {
                      const channel = getChannel(exclusion.targetId);
                      const isVoice = channel ? isVoiceChannel(channel.type) : false;
                      return (
                        <div
                          key={exclusion.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            {isVoice ? (
                              <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
                            ) : (
                              <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-white/40" />
                            )}
                            <span className="text-white/80">
                              {getChannelName(exclusion.targetId)}
                            </span>
                            {isVoice && (
                              <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                                음성
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExclusion(exclusion.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Icon icon="solar:hashtag-linear" className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/40">차단된 채널이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Role Exclusions */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                    <Icon icon="solar:shield-cross-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">차단된 역할</h3>
                    <p className="text-sm text-white/50">이 역할을 가진 유저는 토피를 받을 수 없습니다.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {roleExclusions.length > 0 ? (
                  <div className="space-y-2">
                    {roleExclusions.map((exclusion) => (
                      <div
                        key={exclusion.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-red-500/20 text-red-300 border-red-500/30">@{getRoleName(exclusion.targetId)}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExclusion(exclusion.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Icon icon="solar:shield-linear" className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/40">차단된 역할이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
