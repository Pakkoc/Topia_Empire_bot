"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  useCurrencySettings,
  useUpdateCurrencySettings,
  useCurrencyManagers,
  useAddCurrencyManager,
  useRemoveCurrencyManager,
  useMembers,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { Icon } from "@iconify/react";

const currencySettingsFormSchema = z.object({
  enabled: z.boolean(),
  topyName: z.string().min(1).max(20),
  rubyName: z.string().min(1).max(20),
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

  // Currency managers
  const { data: managers = [], isLoading: managersLoading } = useCurrencyManagers(guildId);
  const addManager = useAddCurrencyManager(guildId);
  const removeManager = useRemoveCurrencyManager(guildId);
  const { data: membersData } = useMembers(guildId, { limit: 100 });
  const members = membersData?.members ?? [];
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const form = useForm<CurrencySettingsFormValues>({
    resolver: zodResolver(currencySettingsFormSchema),
    defaultValues: {
      enabled: true,
      topyName: "토피",
      rubyName: "루비",
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
        enabled: Boolean(settings.enabled),
        topyName: settings.topyName ?? "토피",
        rubyName: settings.rubyName ?? "루비",
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
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
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
        <p className="text-white/50 mt-1">토피 획득 방식을 설정합니다</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 시스템 활성화 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel className="text-white font-medium text-lg">화폐 시스템 활성화</FormLabel>
                    <FormDescription className="text-white/40">
                      활동 보상으로 토피를 획득할 수 있습니다
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
          </div>

          {/* 화폐 관리자 설정 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Icon icon="solar:shield-user-linear" className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">화폐 관리자</h3>
              <p className="text-white/50 text-sm">지정된 유저가 다른 유저에게 무제한 화폐 지급 가능</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Add manager */}
          <div className="flex gap-3">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white focus:ring-violet-500">
                <SelectValue placeholder="유저를 선택하세요" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10">
                {members
                  .filter((m) => !managers.some((mgr) => mgr.userId === m.userId))
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
              disabled={!selectedUserId || addManager.isPending}
              onClick={async () => {
                if (!selectedUserId) return;
                try {
                  await addManager.mutateAsync(selectedUserId);
                  setSelectedUserId("");
                  toast({
                    title: "화폐 관리자 추가",
                    description: "화폐 관리자가 추가되었습니다.",
                  });
                } catch {
                  toast({
                    title: "추가 실패",
                    description: "화폐 관리자를 추가하는 중 오류가 발생했습니다.",
                    variant: "destructive",
                  });
                }
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
              추가
            </Button>
          </div>

          {/* Manager list */}
          {managersLoading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : managers.length > 0 ? (
            <div className="space-y-2">
              {managers.map((manager) => {
                const member = members.find((m) => m.userId === manager.userId);
                return (
                  <div
                    key={manager.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <Icon icon="solar:user-linear" className="h-4 w-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{member?.displayName ?? "알 수 없음"}</p>
                        <p className="text-xs text-white/40">ID: {manager.userId}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await removeManager.mutateAsync(manager.userId);
                          toast({
                            title: "화폐 관리자 제거",
                            description: "화폐 관리자가 제거되었습니다.",
                          });
                        } catch {
                          toast({
                            title: "제거 실패",
                            description: "화폐 관리자를 제거하는 중 오류가 발생했습니다.",
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
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <Icon icon="solar:shield-user-linear" className="h-6 w-6 text-white/20" />
              </div>
              <p className="text-white/50">등록된 화폐 관리자가 없습니다</p>
              <p className="text-xs text-white/30 mt-1">유저를 선택하여 추가해주세요</p>
            </div>
          )}

          {/* Info */}
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Icon icon="solar:info-circle-linear" className="w-5 h-5 text-violet-400 mt-0.5" />
              <div>
                <p className="text-sm text-violet-300 font-medium">화폐 관리자 안내</p>
                <p className="text-xs text-violet-300/70 mt-1">
                  화폐 관리자는 <code className="bg-violet-500/20 px-1 rounded">/지급</code> 명령어로 다른 유저에게 토피/루비를 무제한 지급할 수 있습니다.
                </p>
              </div>
            </div>
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
                <p className="text-white/50 text-sm">서버에서 사용할 화폐 이름을 설정합니다</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="topyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-sm">무상 화폐 이름</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="토피"
                        className="bg-white/5 border-white/10 text-white focus:border-purple-500/50"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      활동으로 획득하는 화폐 (기본: 토피)
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
                    <FormLabel className="text-white/70 text-sm">유상 화폐 이름</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="루비"
                        className="bg-white/5 border-white/10 text-white focus:border-pink-500/50"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      구매/거래로 획득하는 화폐 (기본: 루비)
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
                    <Icon icon="solar:chat-line-linear" className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">텍스트 보상</h3>
                    <p className="text-white/50 text-sm">채팅 메시지 기반 토피 지급</p>
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
                        <FormLabel className="text-white font-medium">활성화</FormLabel>
                        <FormDescription className="text-xs text-white/40">
                          채팅으로 토피 획득
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
                        <FormLabel className="text-white/70 text-sm">최소 토피</FormLabel>
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
                        <FormLabel className="text-white/70 text-sm">최대 토피</FormLabel>
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
                      <FormLabel className="text-white/70 text-sm">최소 메시지 길이</FormLabel>
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
                        <FormLabel className="text-white/70 text-sm">쿨다운 (초)</FormLabel>
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
                        <FormLabel className="text-white/70 text-sm">쿨다운당 횟수</FormLabel>
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
                      <FormLabel className="text-white/70 text-sm">일일 제한</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        하루에 텍스트로 획득 가능한 최대 토피
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
                    <Icon icon="solar:microphone-linear" className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">음성 보상</h3>
                    <p className="text-white/50 text-sm">음성 채널 활동 기반 토피 지급</p>
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
                        <FormLabel className="text-white font-medium">활성화</FormLabel>
                        <FormDescription className="text-xs text-white/40">
                          음성 참여로 토피 획득
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
                        <FormLabel className="text-white/70 text-sm">최소 토피</FormLabel>
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
                        <FormLabel className="text-white/70 text-sm">최대 토피</FormLabel>
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
                      <FormLabel className="text-white/70 text-sm">쿨다운 (초)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        토피 지급 간격 (기본 60초)
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
                      <FormLabel className="text-white/70 text-sm">일일 제한</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-green-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        하루에 음성으로 획득 가능한 최대 토피
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Info about channel categories */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:info-circle-linear" className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-300 font-medium">채널 카테고리</p>
                      <p className="text-xs text-blue-300/70 mt-1">
                        음성 채널 유형별 배율은 화폐 규칙에서 설정할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 이체 설정 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Icon icon="solar:transfer-horizontal-linear" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">이체 설정</h3>
                  <p className="text-white/50 text-sm">유저 간 화폐 이체 최소 금액</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="minTransferTopy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">토피 최소 이체 금액</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-cyan-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        토피 이체 시 최소 금액 (기본: 100)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minTransferRuby"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">루비 최소 이체 금액</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-cyan-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        루비 이체 시 최소 금액 (기본: 1)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="transferFeeTopyPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70 text-sm">토피 이체 수수료 (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-cyan-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        토피 이체 시 부과되는 수수료 (기본: 1.2%)
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
                      <FormLabel className="text-white/70 text-sm">루비 이체 수수료 (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          className="bg-white/5 border-white/10 text-white focus:border-cyan-500/50"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-white/40">
                        루비 이체 시 부과되는 수수료 (기본: 0%)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Info about transfer */}
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:info-circle-linear" className="w-5 h-5 text-cyan-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-cyan-300 font-medium">이체 안내</p>
                    <p className="text-xs text-cyan-300/70 mt-1">
                      수수료는 이체 금액에서 별도로 차감됩니다. 0%로 설정하면 수수료가 부과되지 않습니다.
                    </p>
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
                  <Icon icon="solar:document-text-linear" className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">월말 세금</h3>
                  <p className="text-white/50 text-sm">매월 말일 23시에 토피 잔액에서 자동 차감</p>
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
                      <FormLabel className="text-white font-medium">활성화</FormLabel>
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
                    <FormLabel className="text-white/70 text-sm">세금률 (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        className="bg-white/5 border-white/10 text-white focus:border-red-500/50"
                      />
                    </FormControl>
                    <FormDescription className="text-xs text-white/40">
                      토피 잔액에서 차감되는 세금 비율 (기본: 3.3%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Info about tax */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:info-circle-linear" className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium">월말 세금 안내</p>
                    <p className="text-xs text-red-300/70 mt-1">
                      매월 마지막 날 23시에 모든 유저의 토피 잔액에서 세금이 자동으로 차감됩니다.
                      세금 이력은 거래 기록에서 확인할 수 있습니다.
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
