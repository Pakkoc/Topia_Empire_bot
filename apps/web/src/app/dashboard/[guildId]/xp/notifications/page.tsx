"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings, useChannels } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { useEffect } from "react";
import { Icon } from "@iconify/react";

const notificationFormSchema = z.object({
  levelUpChannelId: z.string().nullable(),
  levelUpMessage: z.string().nullable(),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

const defaultMessage = `🎉 축하합니다 {user}님! **레벨 {level}**에 도달하셨습니다!`;

const placeholders = [
  { name: "{user}", description: "유저 멘션" },
  { name: "{username}", description: "유저 이름" },
  { name: "{level}", description: "현재 레벨" },
  { name: "{xp}", description: "현재 XP" },
  { name: "{server}", description: "서버 이름" },
];

export default function NotificationSettingsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  const { data: settings, isLoading } = useXpSettings(guildId);
  const { data: allChannels, isLoading: channelsLoading } = useChannels(guildId, null);
  const updateSettings = useUpdateXpSettings(guildId);

  // 메시지 전송 가능한 채널만 필터링 (텍스트, 공지, 음성 채널의 텍스트)
  const channels = allChannels?.filter(ch =>
    ch.type === 0 ||  // GUILD_TEXT
    ch.type === 5 ||  // GUILD_ANNOUNCEMENT
    ch.type === 2     // GUILD_VOICE (텍스트 인 보이스)
  );

  // settings에서 channelId를 문자열로 변환 (API에서 숫자로 반환될 수 있음)
  const formValues: NotificationFormValues = {
    levelUpChannelId: settings?.levelUpChannelId ? String(settings.levelUpChannelId) : null,
    levelUpMessage: settings?.levelUpMessage ?? defaultMessage,
  };

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: formValues,
    values: settings ? formValues : undefined, // 외부 데이터와 자동 동기화
  });

  const isDirty = form.formState.isDirty;

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty, setHasUnsavedChanges]);

  const onSubmit = async (data: NotificationFormValues) => {
    try {
      await updateSettings.mutateAsync({
        levelUpChannelId: data.levelUpChannelId || null,
        levelUpMessage: data.levelUpMessage || null,
      });
      toast({
        title: "설정 저장 완료",
        description: "알림 설정이 저장되었습니다.",
      });
    } catch {
      toast({
        title: "저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // settings와 channels 모두 로드될 때까지 로딩 표시
  if (isLoading || channelsLoading || !settings) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>

        {/* Card Skeleton */}
        <div className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/10" />
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
        <h1 className="text-2xl md:text-3xl font-bold text-white">레벨업 알림</h1>
        <p className="text-white/50 mt-1">레벨업 시 발송되는 알림을 설정합니다.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 알림 채널 카드 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 animate-fade-up">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Icon icon="solar:bell-bold" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">알림 채널</h3>
                  <p className="text-sm text-white/50">레벨업 알림이 전송될 채널을 설정합니다.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <FormField
                control={form.control}
                name="levelUpChannelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">채널</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                          {(() => {
                            if (channelsLoading) {
                              return <span className="text-white/40">로딩 중...</span>;
                            }
                            if (!field.value || field.value === "__none__") {
                              return <span className="text-white/40">채널 선택 (선택 안함 = 알림 비활성화)</span>;
                            }
                            const selectedChannel = channels?.find(ch => ch.id === field.value);
                            if (selectedChannel) {
                              return (
                                <span className="!inline-flex items-center gap-2">
                                  {selectedChannel.type === 2 ? (
                                    <Icon icon="solar:volume-loud-linear" className="h-4 w-4 shrink-0 text-green-400" />
                                  ) : selectedChannel.type === 5 ? (
                                    <Icon icon="solar:megaphone-linear" className="h-4 w-4 shrink-0 text-amber-400" />
                                  ) : (
                                    <Icon icon="solar:hashtag-linear" className="h-4 w-4 shrink-0 text-white/40" />
                                  )}
                                  {selectedChannel.name}
                                </span>
                              );
                            }
                            return <span className="text-white/40">채널 로딩 중...</span>;
                          })()}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-white/40">알림 비활성화</span>
                        </SelectItem>
                        {channelsLoading ? (
                          <SelectItem value="__loading__" disabled>
                            <Icon icon="solar:spinner-linear" className="mr-2 inline h-4 w-4 animate-spin" />
                            로딩 중...
                          </SelectItem>
                        ) : channels && channels.length > 0 ? (
                          <>
                            {channels.map((channel) => (
                              <SelectItem key={channel.id} value={channel.id}>
                                <span className="flex items-center gap-2">
                                  {channel.type === 2 ? (
                                    <Icon icon="solar:volume-loud-linear" className="h-4 w-4 text-green-400" />
                                  ) : channel.type === 5 ? (
                                    <Icon icon="solar:megaphone-linear" className="h-4 w-4 text-amber-400" />
                                  ) : (
                                    <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-white/40" />
                                  )}
                                  {channel.name}
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        ) : (
                          <SelectItem value="__empty__" disabled>
                            채널이 없습니다
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-white/40">
                      비워두면 레벨업 알림이 비활성화됩니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* 알림 메시지 카드 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden animate-fade-up" style={{ animationDelay: '50ms' }}>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Icon icon="solar:chat-line-bold" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">알림 메시지</h3>
                  <p className="text-sm text-white/50">레벨업 시 전송될 메시지를 커스텀합니다.</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <FormField
                control={form.control}
                name="levelUpMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70">메시지 템플릿</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={defaultMessage}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        className="min-h-24 border-white/10 bg-white/5 hover:bg-white/10 transition-colors resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <p className="mb-3 text-sm font-medium text-white/70">사용 가능한 변수</p>
                <div className="flex flex-wrap gap-2">
                  {placeholders.map((p) => (
                    <div
                      key={p.name}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition-colors"
                    >
                      <code className="text-sm text-indigo-400 font-mono">{p.name}</code>
                      <span className="ml-2 text-sm text-white/40">{p.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <p className="mb-3 text-sm font-medium text-white/70">미리보기</p>
                <div className="relative rounded-xl border border-white/10 bg-black/50 p-4 overflow-hidden">
                  {/* Discord-like styling */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                  <p className="text-white/80 pl-3">
                    {(form.watch("levelUpMessage") ?? defaultMessage)
                      .replace("{user}", "@사용자")
                      .replace("{username}", "사용자")
                      .replace("{level}", "5")
                      .replace("{xp}", "2,500")
                      .replace("{server}", "서버 이름")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end animate-fade-up" style={{ animationDelay: '100ms' }}>
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white shadow-lg shadow-indigo-500/25"
            >
              {updateSettings.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
