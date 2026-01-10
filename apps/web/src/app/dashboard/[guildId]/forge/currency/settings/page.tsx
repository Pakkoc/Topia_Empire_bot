"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import {
  useAddCurrencyManager,
  useCurrencyManagers,
  useCurrencySettings,
  useMembers,
  useRemoveCurrencyManager,
  useUpdateCurrencySettings,
} from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Icon } from "@iconify/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const currencySettingsFormSchema = z.object({
  topyName: z.string().min(1).max(20),
  rubyName: z.string().min(1).max(20),
  topyManagerEnabled: z.boolean(),
  rubyManagerEnabled: z.boolean(),
  textEarnEnabled: z.boolean(),
  textEarnMin: z.coerce.number().min(0).max(10000),
  textEarnMax: z.coerce.number().min(0).max(10000),
  textMinLength: z.coerce.number().min(0).max(1000),
  textCooldownSeconds: z.coerce.number().min(0).max(3600),
  textMaxPerCooldown: z.coerce.number().min(1).max(100),
  textDailyLimit: z.coerce.number().min(0).max(1000000),
  voiceEarnEnabled: z.boolean(),
  voiceEarnMin: z.coerce.number().min(0).max(10000),
  voiceEarnMax: z.coerce.number().min(0).max(10000),
  voiceCooldownSeconds: z.coerce.number().min(0).max(3600),
  voiceDailyLimit: z.coerce.number().min(0).max(1000000),
  minTransferTopy: z.coerce.number().min(0).max(1000000),
  minTransferRuby: z.coerce.number().min(0).max(1000000),
  transferFeeTopyPercent: z.coerce.number().min(0).max(100),
  transferFeeRubyPercent: z.coerce.number().min(0).max(100),
  // 월말 세금 설정
  monthlyTaxEnabled: z.boolean(),
  monthlyTaxPercent: z.coerce.number().min(0).max(100),
});

type CurrencySettingsFormValues = z.infer<typeof currencySettingsFormSchema>;

export default function CurrencySettingsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  const { data: settings, isLoading } = useCurrencySettings(guildId);
  const updateSettings = useUpdateCurrencySettings(guildId);

  // Currency managers - separate for Topy and Ruby
  const { data: topyManagers = [], isLoading: topyManagersLoading } =
    useCurrencyManagers(guildId, "topy");
  const { data: rubyManagers = [], isLoading: rubyManagersLoading } =
    useCurrencyManagers(guildId, "ruby");
  const addManager = useAddCurrencyManager(guildId);
  const removeManager = useRemoveCurrencyManager(guildId);
  const { data: membersData } = useMembers(guildId, { limit: 100 });
  const members = membersData?.members ?? [];
  const [selectedTopyUserId, setSelectedTopyUserId] = useState<string>("");
  const [selectedRubyUserId, setSelectedRubyUserId] = useState<string>("");

  const form = useForm<CurrencySettingsFormValues>({
    resolver: zodResolver(currencySettingsFormSchema),
    defaultValues: {
      topyName: "토피",
      rubyName: "루비",
      topyManagerEnabled: true,
      rubyManagerEnabled: true,
      textEarnEnabled: true,
      textEarnMin: 1,
      textEarnMax: 1,
      textMinLength: 15,
      textCooldownSeconds: 30,
      textMaxPerCooldown: 1,
      textDailyLimit: 300,
      voiceEarnEnabled: true,
      voiceEarnMin: 1,
      voiceEarnMax: 1,
      voiceCooldownSeconds: 60,
      voiceDailyLimit: 2000,
      minTransferTopy: 100,
      minTransferRuby: 1,
      transferFeeTopyPercent: 1.2,
      transferFeeRubyPercent: 0,
      monthlyTaxEnabled: false,
      monthlyTaxPercent: 3.3,
    },
  });

  const formIsDirty = form.formState.isDirty;

  useEffect(() => {
    setHasUnsavedChanges(formIsDirty);
  }, [formIsDirty, setHasUnsavedChanges]);

  useEffect(() => {
    if (settings) {
      form.reset({
        topyName: settings.topyName ?? "토피",
        rubyName: settings.rubyName ?? "루비",
        topyManagerEnabled: settings.topyManagerEnabled !== false,
        rubyManagerEnabled: settings.rubyManagerEnabled !== false,
        textEarnEnabled: Boolean(settings.textEarnEnabled),
        textEarnMin: settings.textEarnMin ?? 1,
        textEarnMax: settings.textEarnMax ?? 1,
        textMinLength: settings.textMinLength ?? 15,
        textCooldownSeconds: settings.textCooldownSeconds ?? 30,
        textMaxPerCooldown: settings.textMaxPerCooldown ?? 1,
        textDailyLimit: settings.textDailyLimit ?? 300,
        voiceEarnEnabled: Boolean(settings.voiceEarnEnabled),
        voiceEarnMin: settings.voiceEarnMin ?? 1,
        voiceEarnMax: settings.voiceEarnMax ?? 1,
        voiceCooldownSeconds: settings.voiceCooldownSeconds ?? 60,
        voiceDailyLimit: settings.voiceDailyLimit ?? 2000,
        minTransferTopy: settings.minTransferTopy ?? 100,
        minTransferRuby: settings.minTransferRuby ?? 1,
        transferFeeTopyPercent: settings.transferFeeTopyPercent ?? 1.2,
        transferFeeRubyPercent: settings.transferFeeRubyPercent ?? 0,
        monthlyTaxEnabled: Boolean(settings.monthlyTaxEnabled),
        monthlyTaxPercent: settings.monthlyTaxPercent ?? 3.3,
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: CurrencySettingsFormValues) => {
    try {
      await updateSettings.mutateAsync(data);
      form.reset(data);
      toast({
        title: "설정 저장 완료",
        description: "화폐 설정이 저장되었습니다.",
      });
    } catch {
      toast({
        title: "저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5"
            >
              <div className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-12 rounded-lg bg-white/10" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">화폐 설정</h1>
        <p className="text-white/50 mt-1">활동형 화폐({settings?.topyName ?? "토피"}) 획득 방식과 이체 규칙을 설정합니다</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 화폐 관리자 설정 - 2열 그리드 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 토피 관리자 */}
            <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 transition-opacity ${!form.watch("topyManagerEnabled") ? "opacity-50" : ""}`}>
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <Icon
                        icon="solar:shield-user-linear"
                        className="h-5 w-5 text-white"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">활동형 화폐 관리자</h3>
                      <p className="text-white/50 text-sm">
                        {settings?.topyName ?? "토피"} 지급 권한
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="topyManagerEnabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            <div className={`p-6 space-y-4 ${!form.watch("topyManagerEnabled") ? "pointer-events-none" : ""}`}>
              {/* Add topy manager */}
              <div className="flex gap-3">
                <Select
                  value={selectedTopyUserId}
                  onValueChange={setSelectedTopyUserId}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white focus:ring-amber-500">
                    <SelectValue placeholder="유저를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {members
                      .filter(
                        (m) => !topyManagers.some((mgr) => mgr.userId === m.userId)
                      )
                      .map((m) => (
                        <SelectItem
                          key={m.userId}
                          value={m.userId}
                          className="text-white focus:bg-white/10"
                        >
                          {m.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  disabled={!selectedTopyUserId || addManager.isPending}
                  onClick={async () => {
                    if (!selectedTopyUserId) return;
                    try {
                      await addManager.mutateAsync({ userId: selectedTopyUserId, currencyType: "topy" });
                      setSelectedTopyUserId("");
                      toast({
                        title: `${settings?.topyName ?? "토피"} 관리자 추가`,
                        description: "관리자가 추가되었습니다.",
                      });
                    } catch {
                      toast({
                        title: "추가 실패",
                        description: "관리자를 추가하는 중 오류가 발생했습니다.",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                  추가
                </Button>
              </div>

              {/* Topy manager list */}
              {topyManagersLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : topyManagers.length > 0 ? (
                <div className="space-y-2">
                  {topyManagers.map((manager) => {
                    const member = members.find((m) => m.userId === manager.userId);
                    return (
                      <div
                        key={manager.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Icon icon="solar:user-linear" className="h-4 w-4 text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {member?.displayName ?? "알 수 없음"}
                            </p>
                            <p className="text-xs text-white/40">ID: {manager.userId}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await removeManager.mutateAsync({ userId: manager.userId, currencyType: "topy" });
                              toast({
                                title: `${settings?.topyName ?? "토피"} 관리자 제거`,
                                description: "관리자가 제거되었습니다.",
                              });
                            } catch {
                              toast({
                                title: "제거 실패",
                                description: "관리자를 제거하는 중 오류가 발생했습니다.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={removeManager.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                    <Icon icon="solar:shield-user-linear" className="h-5 w-5 text-white/20" />
                  </div>
                  <p className="text-sm text-white/50">등록된 관리자가 없습니다</p>
                </div>
              )}
            </div>
            </div>

            {/* 루비 관리자 */}
            <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 transition-opacity ${!form.watch("rubyManagerEnabled") ? "opacity-50" : ""}`}>
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                      <Icon
                        icon="solar:shield-user-linear"
                        className="h-5 w-5 text-white"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">수익형 화폐 관리자</h3>
                      <p className="text-white/50 text-sm">
                        {settings?.rubyName ?? "루비"} 지급 권한
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="rubyManagerEnabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            <div className={`p-6 space-y-4 ${!form.watch("rubyManagerEnabled") ? "pointer-events-none" : ""}`}>
              {/* Add ruby manager */}
              <div className="flex gap-3">
                <Select
                  value={selectedRubyUserId}
                  onValueChange={setSelectedRubyUserId}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white focus:ring-pink-500">
                    <SelectValue placeholder="유저를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    {members
                      .filter(
                        (m) => !rubyManagers.some((mgr) => mgr.userId === m.userId)
                      )
                      .map((m) => (
                        <SelectItem
                          key={m.userId}
                          value={m.userId}
                          className="text-white focus:bg-white/10"
                        >
                          {m.displayName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  disabled={!selectedRubyUserId || addManager.isPending}
                  onClick={async () => {
                    if (!selectedRubyUserId) return;
                    try {
                      await addManager.mutateAsync({ userId: selectedRubyUserId, currencyType: "ruby" });
                      setSelectedRubyUserId("");
                      toast({
                        title: `${settings?.rubyName ?? "루비"} 관리자 추가`,
                        description: "관리자가 추가되었습니다.",
                      });
                    } catch {
                      toast({
                        title: "추가 실패",
                        description: "관리자를 추가하는 중 오류가 발생했습니다.",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="bg-pink-600 hover:bg-pink-500 text-white"
                >
                  <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                  추가
                </Button>
              </div>

              {/* Ruby manager list */}
              {rubyManagersLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : rubyManagers.length > 0 ? (
                <div className="space-y-2">
                  {rubyManagers.map((manager) => {
                    const member = members.find((m) => m.userId === manager.userId);
                    return (
                      <div
                        key={manager.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                            <Icon icon="solar:user-linear" className="h-4 w-4 text-pink-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {member?.displayName ?? "알 수 없음"}
                            </p>
                            <p className="text-xs text-white/40">ID: {manager.userId}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              await removeManager.mutateAsync({ userId: manager.userId, currencyType: "ruby" });
                              toast({
                                title: `${settings?.rubyName ?? "루비"} 관리자 제거`,
                                description: "관리자가 제거되었습니다.",
                              });
                            } catch {
                              toast({
                                title: "제거 실패",
                                description: "관리자를 제거하는 중 오류가 발생했습니다.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={removeManager.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-2">
                    <Icon icon="solar:shield-user-linear" className="h-5 w-5 text-white/20" />
                  </div>
                  <p className="text-sm text-white/50">등록된 관리자가 없습니다</p>
                </div>
              )}

              {/* Warning for ruby managers */}
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Icon
                    icon="solar:shield-warning-linear"
                    className="w-5 h-5 text-rose-400 mt-0.5"
                  />
                  <div>
                    <p className="text-sm text-rose-300 font-medium">
                      유료 화폐 관리 주의
                    </p>
                    <p className="text-xs text-rose-300/70 mt-1">
                      신뢰할 수 있는 관리자만 지정하세요.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* 화폐 관리자 안내 */}
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Icon
                icon="solar:info-circle-linear"
                className="w-5 h-5 text-violet-400 mt-0.5"
              />
              <div>
                <p className="text-sm text-violet-300 font-medium">
                  화폐 관리자 안내
                </p>
                <p className="text-xs text-violet-300/70 mt-1">
                  <code className="bg-violet-500/20 px-1 rounded">/지급</code>{" "}
                  명령어로 해당 화폐를 무제한 지급할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 화폐 이름 설정 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Icon icon="solar:pen-linear" className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">화폐 이름</h3>
                <p className="text-white/50 text-sm">
                  서버에서 사용할 화폐 이름을 설정합니다
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="topyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-sm">
                      활동형 화폐 이름
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="토피"
                        className="bg-white/5 border-white/10 text-white focus:border-purple-500/50"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      채팅/음성 활동으로 획득 (기본: 토피)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rubyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-sm">
                      수익형 화폐 이름
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="루비"
                        className="bg-white/5 border-white/10 text-white focus:border-pink-500/50"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      구매/장터 거래로 획득 (기본: 루비)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 텍스트 보상 설정 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Icon
                      icon="solar:chat-line-linear"
                      className="h-5 w-5 text-white"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">텍스트 보상</h3>
                    <p className="text-white/50 text-sm">
                      채팅 메시지 기반 {settings?.topyName ?? "토피"} 지급
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <FormField
                  control={form.control}
                  name="textEarnEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white font-medium">
                          활성화
                        </FormLabel>
                        <FormDescription className="text-xs text-white/40">
                          채팅으로 {settings?.topyName ?? "토피"} 획득
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="textEarnMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">
                          최소 지급량
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textEarnMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">
                          최대 지급량
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="textMinLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        최소 메시지 글자수
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        이 길이 이상의 메시지만 보상
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="textCooldownSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">
                          쿨다운 (초)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textMaxPerCooldown"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">
                          쿨다운당 횟수
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="textDailyLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        일일 제한
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        하루에 텍스트로 획득 가능한 최대량
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 음성 보상 설정 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Icon
                      icon="solar:microphone-linear"
                      className="h-5 w-5 text-white"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">음성 보상</h3>
                    <p className="text-white/50 text-sm">
                      음성 채널 활동 기반 {settings?.topyName ?? "토피"} 지급
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <FormField
                  control={form.control}
                  name="voiceEarnEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-white font-medium">
                          활성화
                        </FormLabel>
                        <FormDescription className="text-xs text-white/40">
                          음성 참여로 {settings?.topyName ?? "토피"} 획득
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="voiceEarnMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">
                          최소 지급량
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voiceEarnMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/70 text-sm">
                          최대 지급량
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="voiceCooldownSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        쿨다운 (초)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        지급 간격 (기본 60초)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voiceDailyLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        일일 제한
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        하루에 음성으로 획득 가능한 최대량
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Info about channel categories */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Icon
                      icon="solar:info-circle-linear"
                      className="w-5 h-5 text-blue-400 mt-0.5"
                    />
                    <div>
                      <p className="text-sm text-blue-300 font-medium">
                        채널 카테고리
                      </p>
                      <p className="text-xs text-blue-300/70 mt-1">
                        음성 채널 유형별 배율은 화폐 규칙에서 설정할 수
                        있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 이체 설정 - 2열 그리드로 분리 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 활동형 화폐(토피) 이체 설정 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-amber-500/30 overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Icon
                      icon="solar:transfer-horizontal-linear"
                      className="h-5 w-5 text-white"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">활동형 화폐 이체</h3>
                    <p className="text-white/50 text-sm">
                      {settings?.topyName ?? "토피"} 이체 규칙
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <FormField
                  control={form.control}
                  name="minTransferTopy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        최소 이체 금액
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        {settings?.topyName ?? "토피"} 이체 시 최소 금액 (기본: 100)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transferFeeTopyPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        이체 수수료 (%)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        0~100% 범위 (기본: 1.2%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 토피 이체 안내 */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Icon
                      icon="solar:info-circle-linear"
                      className="w-5 h-5 text-amber-400 mt-0.5"
                    />
                    <div>
                      <p className="text-sm text-amber-300 font-medium">
                        활동형 화폐 이체 안내
                      </p>
                      <p className="text-xs text-amber-300/70 mt-1">
                        수수료는 이체 금액에서 별도로 차감됩니다.
                        0%로 설정하면 수수료가 부과되지 않습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 수익형 화폐(루비) 이체 설정 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-pink-500/30 overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-gradient-to-r from-pink-500/10 to-rose-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                    <Icon
                      icon="solar:transfer-horizontal-linear"
                      className="h-5 w-5 text-white"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">수익형 화폐 이체</h3>
                    <p className="text-white/50 text-sm">
                      {settings?.rubyName ?? "루비"} 이체 규칙
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <FormField
                  control={form.control}
                  name="minTransferRuby"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        최소 이체 금액
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-pink-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        {settings?.rubyName ?? "루비"} 이체 시 최소 금액 (기본: 1)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transferFeeRubyPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">
                        이체 수수료 (%)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-pink-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        0~100% 범위 (기본: 0%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 루비 이체 안내 */}
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Icon
                      icon="solar:shield-warning-linear"
                      className="w-5 h-5 text-rose-400 mt-0.5"
                    />
                    <div>
                      <p className="text-sm text-rose-300 font-medium">
                        수익형 화폐 이체 주의
                      </p>
                      <p className="text-xs text-rose-300/70 mt-1">
                        유료로 구매한 화폐입니다.
                        이체 수수료 설정에 주의하세요.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 월말 세금 설정 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                  <Icon
                    icon="solar:document-text-linear"
                    className="h-5 w-5 text-white"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-white">월말 세금</h3>
                  <p className="text-white/50 text-sm">
                    매월 말일 23시에 {settings?.topyName ?? "토피"} 잔액에서 자동 차감
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <FormField
                control={form.control}
                name="monthlyTaxEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-white font-medium">
                        활성화
                      </FormLabel>
                      <FormDescription className="text-xs text-white/40">
                        월말 세금 자동 차감 기능
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyTaxPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-sm">
                      세금률 (%)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        className="bg-white/5 border-white/10 text-white focus:border-red-500/50"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      {settings?.topyName ?? "토피"} 잔액에서 차감되는 세금 비율 (기본: 3.3%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Info about tax */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Icon
                    icon="solar:info-circle-linear"
                    className="w-5 h-5 text-red-400 mt-0.5"
                  />
                  <div>
                    <p className="text-sm text-red-300 font-medium">
                      월말 세금 안내
                    </p>
                    <p className="text-xs text-red-300/70 mt-1">
                      매월 마지막 날 23시에 모든 유저의 {settings?.topyName ?? "토피"} 잔액에서 세금이
                      자동으로 차감됩니다. 세금 이력은 거래 기록에서 확인할 수
                      있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
            >
              <Icon icon="solar:diskette-linear" className="mr-2 h-4 w-4" />
              {updateSettings.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
