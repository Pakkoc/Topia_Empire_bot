"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCurrencyHotTimes,
  useCreateCurrencyHotTime,
  useDeleteCurrencyHotTime,
  useCurrencyExclusions,
  useCreateCurrencyExclusion,
  useDeleteCurrencyExclusion,
  useCurrencyMultipliers,
  useCreateCurrencyMultiplier,
  useDeleteCurrencyMultiplier,
  useChannelCategories,
  useCreateChannelCategory,
  useDeleteChannelCategory,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";
import { CHANNEL_CATEGORY_LABELS, CHANNEL_CATEGORY_MULTIPLIERS } from "@/types/currency";

const hotTimeSchema = z.object({
  type: z.enum(["text", "voice", "all"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식이어야 합니다"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식이어야 합니다"),
  multiplier: z.coerce.number().min(1).max(10),
  enabled: z.boolean(),
});

const exclusionSchema = z.object({
  targetType: z.enum(["channel", "role"]),
  targetId: z.string().min(1, "대상을 선택해주세요"),
});

const multiplierSchema = z.object({
  targetType: z.enum(["channel", "role"]),
  targetId: z.string().min(1, "대상을 선택해주세요"),
  multiplier: z.coerce.number().min(0.1).max(10),
});

const channelCategorySchema = z.object({
  channelId: z.string().min(1, "채널을 선택해주세요"),
  category: z.enum(["normal", "music", "afk", "premium"]),
});

// Channel type constants
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_VOICE = 2;

export default function CurrencyRulesPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hottime");
  const [selectedHotTimeChannels, setSelectedHotTimeChannels] = useState<string[]>([]);

  // Data queries
  const { data: hotTimes = [], isLoading: hotTimesLoading } = useCurrencyHotTimes(guildId);
  const { data: exclusions = [], isLoading: exclusionsLoading } = useCurrencyExclusions(guildId);
  const { data: multipliers = [], isLoading: multipliersLoading } = useCurrencyMultipliers(guildId);
  const { data: channelCategories = [], isLoading: categoriesLoading } = useChannelCategories(guildId);
  const { data: channels = [] } = useChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);

  // Mutations
  const createHotTime = useCreateCurrencyHotTime(guildId);
  const deleteHotTime = useDeleteCurrencyHotTime(guildId);
  const createExclusion = useCreateCurrencyExclusion(guildId);
  const deleteExclusion = useDeleteCurrencyExclusion(guildId);
  const createMultiplier = useCreateCurrencyMultiplier(guildId);
  const deleteMultiplier = useDeleteCurrencyMultiplier(guildId);
  const createChannelCategory = useCreateChannelCategory(guildId);
  const deleteChannelCategory = useDeleteChannelCategory(guildId);

  // Forms
  const hotTimeForm = useForm({
    resolver: zodResolver(hotTimeSchema),
    defaultValues: {
      type: "all" as const,
      startTime: "20:00",
      endTime: "23:00",
      multiplier: 1.5,
      enabled: true,
    },
  });

  const exclusionForm = useForm({
    resolver: zodResolver(exclusionSchema),
    defaultValues: {
      targetType: "channel" as const,
      targetId: "",
    },
  });

  const multiplierForm = useForm({
    resolver: zodResolver(multiplierSchema),
    defaultValues: {
      targetType: "channel" as const,
      targetId: "",
      multiplier: 1.5,
    },
  });

  const channelCategoryForm = useForm({
    resolver: zodResolver(channelCategorySchema),
    defaultValues: {
      channelId: "",
      category: "normal" as const,
    },
  });

  // Handlers
  const onSubmitHotTime = async (data: z.infer<typeof hotTimeSchema>) => {
    try {
      await createHotTime.mutateAsync({
        ...data,
        channelIds: selectedHotTimeChannels.length > 0 ? selectedHotTimeChannels : undefined,
      });
      hotTimeForm.reset();
      setSelectedHotTimeChannels([]);
      toast({ title: "핫타임 추가 완료" });
    } catch {
      toast({ title: "추가 실패", variant: "destructive" });
    }
  };

  const onSubmitExclusion = async (data: z.infer<typeof exclusionSchema>) => {
    try {
      await createExclusion.mutateAsync(data);
      exclusionForm.reset();
      toast({ title: "제외 대상 추가 완료" });
    } catch {
      toast({ title: "추가 실패", variant: "destructive" });
    }
  };

  const onSubmitMultiplier = async (data: z.infer<typeof multiplierSchema>) => {
    try {
      await createMultiplier.mutateAsync(data);
      multiplierForm.reset();
      toast({ title: "배율 추가 완료" });
    } catch {
      toast({ title: "추가 실패", variant: "destructive" });
    }
  };

  const onSubmitChannelCategory = async (data: z.infer<typeof channelCategorySchema>) => {
    try {
      await createChannelCategory.mutateAsync(data);
      channelCategoryForm.reset();
      toast({ title: "채널 카테고리 추가 완료" });
    } catch {
      toast({ title: "추가 실패", variant: "destructive" });
    }
  };

  const voiceChannels = channels.filter(c => c.type === CHANNEL_TYPE_VOICE);
  const textChannels = channels.filter(c => c.type === CHANNEL_TYPE_TEXT);

  // 음성 채널 먼저, 텍스트 채널 나중에 정렬된 목록
  const sortedChannels = [...channels].sort((a, b) => {
    const aIsVoice = a.type === CHANNEL_TYPE_VOICE;
    const bIsVoice = b.type === CHANNEL_TYPE_VOICE;
    if (aIsVoice && !bIsVoice) return -1;
    if (!aIsVoice && bIsVoice) return 1;
    return 0;
  });

  // 핫타임 유형에 따라 채널 옵션 필터링
  const hotTimeType = hotTimeForm.watch("type");
  const hotTimeChannelOptions: MultiSelectOption[] = (() => {
    let filteredChannels = channels;
    if (hotTimeType === "text") {
      filteredChannels = textChannels;
    } else if (hotTimeType === "voice") {
      filteredChannels = voiceChannels;
    }
    return filteredChannels
      .sort((a, b) => {
        // 음성 채널 먼저, 텍스트 채널 나중에 정렬
        const aIsVoice = a.type === CHANNEL_TYPE_VOICE;
        const bIsVoice = b.type === CHANNEL_TYPE_VOICE;
        if (aIsVoice && !bIsVoice) return -1;
        if (!aIsVoice && bIsVoice) return 1;
        return 0;
      })
      .map(ch => ({
        value: ch.id,
        label: ch.name,
        icon: ch.type === CHANNEL_TYPE_VOICE ? (
          <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
        ) : (
          <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-slate-400" />
        ),
        group: ch.type === CHANNEL_TYPE_VOICE ? "🔊 음성 채널" : "# 텍스트 채널",
      }));
  })();

  const isLoading = hotTimesLoading || exclusionsLoading || multipliersLoading || categoriesLoading;

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
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">화폐 규칙</h1>
        <p className="text-white/50 mt-1">핫타임, 제외 대상, 배율을 설정합니다</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
          <TabsTrigger
            value="hottime"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg px-4 py-2 text-white/60"
          >
            <Icon icon="solar:fire-linear" className="mr-2 h-4 w-4" />
            핫타임
          </TabsTrigger>
          <TabsTrigger
            value="exclusion"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg px-4 py-2 text-white/60"
          >
            <Icon icon="solar:close-circle-linear" className="mr-2 h-4 w-4" />
            제외
          </TabsTrigger>
          <TabsTrigger
            value="multiplier"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg px-4 py-2 text-white/60"
          >
            <Icon icon="solar:graph-up-linear" className="mr-2 h-4 w-4" />
            배율
          </TabsTrigger>
          <TabsTrigger
            value="channel-category"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg px-4 py-2 text-white/60"
          >
            <Icon icon="solar:volume-loud-linear" className="mr-2 h-4 w-4" />
            채널 유형
          </TabsTrigger>
        </TabsList>

        {/* 핫타임 탭 */}
        <TabsContent value="hottime" className="space-y-6 animate-fade-up">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">핫타임 추가</h3>
            <Form {...hotTimeForm}>
              <form onSubmit={hotTimeForm.handleSubmit(onSubmitHotTime)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-5">
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
                            step="0.1"
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
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-end gap-2 pb-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-white/70 text-sm">활성화</FormLabel>
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
                    placeholder="채널을 선택하세요 (미선택 시 전체 적용)"
                  />
                  <p className="text-xs text-white/40">
                    선택하지 않으면 모든 채널에 적용됩니다.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={createHotTime.isPending}
                  className="bg-gradient-to-r from-amber-600 to-orange-600"
                >
                  <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                  추가
                </Button>
              </form>
            </Form>
          </div>

          {/* 핫타임 목록 */}
          <div className="space-y-3">
            {hotTimes.map((ht) => {
              const appliedChannels = (ht.channelIds ?? [])
                .map(id => channels.find(c => c.id === id))
                .filter(Boolean);
              return (
                <div
                  key={ht.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={`w-2 h-2 rounded-full ${ht.enabled ? 'bg-green-500' : 'bg-white/30'}`} />
                    <span className="text-white font-medium">
                      {ht.type === 'all' ? '전체' : ht.type === 'text' ? '텍스트' : '음성'}
                    </span>
                    <span className="text-white/60">
                      {ht.startTime} ~ {ht.endTime}
                    </span>
                    <span className="text-amber-400 font-medium">x{ht.multiplier}</span>
                    {appliedChannels.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Icon icon="solar:map-point-linear" className="h-4 w-4 text-white/40" />
                        {appliedChannels.slice(0, 3).map(ch => (
                          <span
                            key={ch!.id}
                            className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-xs flex items-center gap-1"
                          >
                            {ch!.type === CHANNEL_TYPE_VOICE ? (
                              <Icon icon="solar:volume-loud-linear" className="h-3 w-3 text-green-400" />
                            ) : (
                              <Icon icon="solar:hashtag-linear" className="h-3 w-3 text-slate-400" />
                            )}
                            {ch!.name}
                          </span>
                        ))}
                        {appliedChannels.length > 3 && (
                          <span className="text-white/40 text-xs">+{appliedChannels.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-white/40 text-xs">모든 채널</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteHotTime.mutate(ht.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {hotTimes.length === 0 && (
              <div className="text-center py-8 text-white/40">
                등록된 핫타임이 없습니다
              </div>
            )}
          </div>
        </TabsContent>

        {/* 제외 탭 */}
        <TabsContent value="exclusion" className="space-y-6 animate-fade-up">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">제외 대상 추가</h3>
            <Form {...exclusionForm}>
              <form onSubmit={exclusionForm.handleSubmit(onSubmitExclusion)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={exclusionForm.control}
                    name="targetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">유형</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="channel">채널</SelectItem>
                            <SelectItem value="role">역할</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={exclusionForm.control}
                    name="targetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">대상</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue placeholder="선택..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {exclusionForm.watch("targetType") === "channel" ? (
                              <>
                                {voiceChannels.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-xs text-slate-400">🔊 음성 채널</SelectLabel>
                                    {voiceChannels.map((ch) => (
                                      <SelectItem key={ch.id} value={ch.id}>
                                        <span className="flex items-center gap-2">
                                          <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
                                          {ch.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {textChannels.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-xs text-slate-400"># 텍스트 채널</SelectLabel>
                                    {textChannels.map((ch) => (
                                      <SelectItem key={ch.id} value={ch.id}>
                                        <span className="flex items-center gap-2">
                                          <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-slate-400" />
                                          {ch.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </>
                            ) : (
                              roles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  @{r.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={createExclusion.isPending}
                      className="bg-gradient-to-r from-amber-600 to-orange-600"
                    >
                      <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                      추가
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* 제외 목록 */}
          <div className="space-y-3">
            {exclusions.map((ex) => {
              const target = ex.targetType === "channel"
                ? channels.find(c => c.id === ex.targetId)
                : roles.find(r => r.id === ex.targetId);
              return (
                <div
                  key={ex.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4"
                >
                  <div className="flex items-center gap-4">
                    <Icon
                      icon={ex.targetType === "channel" ? "solar:hashtag-linear" : "solar:shield-user-linear"}
                      className="h-5 w-5 text-white/60"
                    />
                    <span className="text-white">
                      {ex.targetType === "channel" ? "#" : "@"}
                      {target?.name ?? ex.targetId}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteExclusion.mutate(ex.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {exclusions.length === 0 && (
              <div className="text-center py-8 text-white/40">
                제외된 채널/역할이 없습니다
              </div>
            )}
          </div>
        </TabsContent>

        {/* 배율 탭 */}
        <TabsContent value="multiplier" className="space-y-6 animate-fade-up">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">배율 추가</h3>
            <Form {...multiplierForm}>
              <form onSubmit={multiplierForm.handleSubmit(onSubmitMultiplier)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={multiplierForm.control}
                    name="targetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">유형</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="channel">채널</SelectItem>
                            <SelectItem value="role">역할</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={multiplierForm.control}
                    name="targetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">대상</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue placeholder="선택..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {multiplierForm.watch("targetType") === "channel" ? (
                              <>
                                {voiceChannels.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-xs text-slate-400">🔊 음성 채널</SelectLabel>
                                    {voiceChannels.map((ch) => (
                                      <SelectItem key={ch.id} value={ch.id}>
                                        <span className="flex items-center gap-2">
                                          <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
                                          {ch.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {textChannels.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-xs text-slate-400"># 텍스트 채널</SelectLabel>
                                    {textChannels.map((ch) => (
                                      <SelectItem key={ch.id} value={ch.id}>
                                        <span className="flex items-center gap-2">
                                          <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-slate-400" />
                                          {ch.name}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </>
                            ) : (
                              roles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  @{r.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={multiplierForm.control}
                    name="multiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">배율</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={createMultiplier.isPending}
                      className="bg-gradient-to-r from-amber-600 to-orange-600"
                    >
                      <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                      추가
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* 배율 목록 */}
          <div className="space-y-3">
            {multipliers.map((m) => {
              const target = m.targetType === "channel"
                ? channels.find(c => c.id === m.targetId)
                : roles.find(r => r.id === m.targetId);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4"
                >
                  <div className="flex items-center gap-4">
                    <Icon
                      icon={m.targetType === "channel" ? "solar:hashtag-linear" : "solar:shield-user-linear"}
                      className="h-5 w-5 text-white/60"
                    />
                    <span className="text-white">
                      {m.targetType === "channel" ? "#" : "@"}
                      {target?.name ?? m.targetId}
                    </span>
                    <span className="text-amber-400 font-medium">x{m.multiplier}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMultiplier.mutate(m.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {multipliers.length === 0 && (
              <div className="text-center py-8 text-white/40">
                설정된 배율이 없습니다
              </div>
            )}
          </div>
        </TabsContent>

        {/* 채널 유형 탭 */}
        <TabsContent value="channel-category" className="space-y-6 animate-fade-up">
          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Icon icon="solar:info-circle-linear" className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm text-blue-300 font-medium">채널 카테고리별 배율</p>
                <p className="text-sm text-blue-300/70 mt-1">
                  음성 채널 유형에 따라 토피 획득 배율이 달라집니다.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {Object.entries(CHANNEL_CATEGORY_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="text-white/60">{label}:</span>
                      <span className="text-amber-400 font-medium">
                        x{CHANNEL_CATEGORY_MULTIPLIERS[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">채널 카테고리 설정</h3>
            <Form {...channelCategoryForm}>
              <form onSubmit={channelCategoryForm.handleSubmit(onSubmitChannelCategory)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={channelCategoryForm.control}
                    name="channelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">음성 채널</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue placeholder="채널 선택..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {voiceChannels.map((ch) => (
                              <SelectItem key={ch.id} value={ch.id}>
                                🔊 {ch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={channelCategoryForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">카테고리</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(CHANNEL_CATEGORY_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label} (x{CHANNEL_CATEGORY_MULTIPLIERS[key]})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={createChannelCategory.isPending}
                      className="bg-gradient-to-r from-amber-600 to-orange-600"
                    >
                      <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                      추가
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* 채널 카테고리 목록 */}
          <div className="space-y-3">
            {channelCategories.map((cc) => {
              const channel = voiceChannels.find(c => c.id === cc.channelId);
              return (
                <div
                  key={cc.id}
                  className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4"
                >
                  <div className="flex items-center gap-4">
                    <Icon icon="solar:volume-loud-linear" className="h-5 w-5 text-white/60" />
                    <span className="text-white">{channel?.name ?? cc.channelId}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-sm">
                      {CHANNEL_CATEGORY_LABELS[cc.category]} (x{CHANNEL_CATEGORY_MULTIPLIERS[cc.category]})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteChannelCategory.mutate(cc.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {channelCategories.length === 0 && (
              <div className="text-center py-8 text-white/40">
                설정된 채널 카테고리가 없습니다. 기본값(일반 통화방)이 적용됩니다.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
