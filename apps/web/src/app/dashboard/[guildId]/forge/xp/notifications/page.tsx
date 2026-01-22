"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings, useChannels } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

const notificationFormSchema = z.object({
  textLevelUpNotificationEnabled: z.boolean(),
  textLevelUpChannelId: z.string().nullable(),
  textLevelUpMessage: z.string().nullable(),
  voiceLevelUpNotificationEnabled: z.boolean(),
  voiceLevelUpChannelId: z.string().nullable(),
  voiceLevelUpMessage: z.string().nullable(),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

const defaultTextMessage = `🎉 축하합니다 {user}님! **텍스트 레벨 {level}**에 도달하셨습니다!`;
const defaultVoiceMessage = `🎉 축하합니다 {user}님! **음성 레벨 {level}**에 도달하셨습니다!`;

const placeholders = [
  { name: "{user}", description: "유저 멘션" },
  { name: "{username}", description: "유저 이름" },
  { name: "{level}", description: "현재 레벨" },
  { name: "{xp}", description: "현재 XP" },
  { name: "{server}", description: "서버 이름" },
];

// 디스코드 마크다운을 HTML로 변환하는 함수
function parseDiscordMarkdown(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // **bold** 패턴 찾기
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // *italic* 패턴 찾기 (단일 *)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    // __underline__ 패턴 찾기
    const underlineMatch = remaining.match(/__(.+?)__/);
    // ~~strikethrough~~ 패턴 찾기
    const strikeMatch = remaining.match(/~~(.+?)~~/);
    // `code` 패턴 찾기
    const codeMatch = remaining.match(/`(.+?)`/);

    // 가장 먼저 나오는 패턴 찾기
    const matches = [
      { match: boldMatch, type: 'bold' },
      { match: italicMatch, type: 'italic' },
      { match: underlineMatch, type: 'underline' },
      { match: strikeMatch, type: 'strike' },
      { match: codeMatch, type: 'code' },
    ].filter(m => m.match !== null) as { match: RegExpMatchArray; type: string }[];

    if (matches.length === 0) {
      // 더 이상 패턴이 없으면 나머지 텍스트 추가
      result.push(remaining);
      break;
    }

    // 가장 먼저 나오는 패턴 선택
    const earliest = matches.reduce((prev, curr) =>
      (curr.match.index ?? 0) < (prev.match.index ?? 0) ? curr : prev
    );

    const matchIndex = earliest.match.index ?? 0;
    const matchedText = earliest.match[1];
    const fullMatch = earliest.match[0];

    // 패턴 전의 텍스트 추가
    if (matchIndex > 0) {
      result.push(remaining.slice(0, matchIndex));
    }

    // 패턴에 따라 스타일 적용
    switch (earliest.type) {
      case 'bold':
        result.push(<strong key={keyIndex++} className="font-bold">{matchedText}</strong>);
        break;
      case 'italic':
        result.push(<em key={keyIndex++} className="italic">{matchedText}</em>);
        break;
      case 'underline':
        result.push(<span key={keyIndex++} className="underline">{matchedText}</span>);
        break;
      case 'strike':
        result.push(<span key={keyIndex++} className="line-through">{matchedText}</span>);
        break;
      case 'code':
        result.push(
          <code key={keyIndex++} className="bg-black/50 px-1 py-0.5 rounded text-[#eb459e] font-mono text-[0.875em]">
            {matchedText}
          </code>
        );
        break;
    }

    remaining = remaining.slice(matchIndex + fullMatch.length);
  }

  return result;
}

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
    textLevelUpNotificationEnabled: settings?.textLevelUpNotificationEnabled ?? true,
    textLevelUpChannelId: settings?.textLevelUpChannelId ? String(settings.textLevelUpChannelId) : null,
    textLevelUpMessage: settings?.textLevelUpMessage ?? defaultTextMessage,
    voiceLevelUpNotificationEnabled: settings?.voiceLevelUpNotificationEnabled ?? true,
    voiceLevelUpChannelId: settings?.voiceLevelUpChannelId ? String(settings.voiceLevelUpChannelId) : null,
    voiceLevelUpMessage: settings?.voiceLevelUpMessage ?? defaultVoiceMessage,
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
        textLevelUpNotificationEnabled: data.textLevelUpNotificationEnabled,
        textLevelUpChannelId: data.textLevelUpChannelId || null,
        textLevelUpMessage: data.textLevelUpMessage || null,
        voiceLevelUpNotificationEnabled: data.voiceLevelUpNotificationEnabled,
        voiceLevelUpChannelId: data.voiceLevelUpChannelId || null,
        voiceLevelUpMessage: data.voiceLevelUpMessage || null,
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

  // 채널 선택 컴포넌트 (검색 가능한 Combobox)
  const ChannelSelect = ({ field, disabled }: { field: { value: string | null; onChange: (value: string | null) => void }; disabled?: boolean }) => {
    const [open, setOpen] = useState(false);
    const selectedChannel = channels?.find(ch => ch.id === field.value);

    const getChannelIcon = (type: number) => {
      if (type === 2) {
        return <Icon icon="solar:volume-loud-linear" className="h-4 w-4 shrink-0 text-green-400" />;
      } else if (type === 5) {
        return <Icon icon="solar:megaphone-linear" className="h-4 w-4 shrink-0 text-amber-400" />;
      }
      return <Icon icon="solar:hashtag-linear" className="h-4 w-4 shrink-0 text-white/40" />;
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between border-white/10 bg-white/5 hover:bg-white/10 transition-colors font-normal"
              disabled={disabled}
            >
              {channelsLoading ? (
                <span className="text-white/40">로딩 중...</span>
              ) : selectedChannel ? (
                <span className="flex items-center gap-2">
                  {getChannelIcon(selectedChannel.type)}
                  {selectedChannel.name}
                </span>
              ) : (
                <span className="text-white/40">채널 선택 (선택 안함 = 알림 비활성화)</span>
              )}
              <Icon icon="solar:alt-arrow-down-linear" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="채널 검색..." />
            <CommandList>
              <CommandEmpty>채널을 찾을 수 없습니다</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    field.onChange(null);
                    setOpen(false);
                  }}
                >
                  <Icon icon="solar:close-circle-linear" className="h-4 w-4 shrink-0 text-white/40" />
                  <span className="text-white/60">알림 비활성화</span>
                  {!field.value && (
                    <Icon icon="solar:check-circle-bold" className="ml-auto h-4 w-4 text-indigo-400" />
                  )}
                </CommandItem>
                {channels?.map((channel) => (
                  <CommandItem
                    key={channel.id}
                    value={channel.name}
                    onSelect={() => {
                      field.onChange(channel.id);
                      setOpen(false);
                    }}
                  >
                    {getChannelIcon(channel.type)}
                    {channel.name}
                    {field.value === channel.id && (
                      <Icon icon="solar:check-circle-bold" className="ml-auto h-4 w-4 text-indigo-400" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
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
        <p className="text-white/50 mt-1">텍스트/음성 레벨업 시 발송되는 알림을 각각 설정합니다.</p>
      </div>

      {/* 안내 박스 */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 animate-fade-up">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:lightbulb-bolt-linear" className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-amber-300 font-medium">레벨업 알림 안내</p>
            <ul className="text-sm text-amber-300/70 space-y-1 list-disc list-inside">
              <li>텍스트 레벨업과 음성 레벨업 알림을 각각 별도로 설정할 수 있습니다</li>
              <li>메시지에 <code className="bg-amber-500/20 px-1 rounded">{'{user}'}</code>, <code className="bg-amber-500/20 px-1 rounded">{'{level}'}</code> 등의 변수를 사용할 수 있습니다</li>
              <li>채널을 선택하지 않으면 해당 타입의 알림이 비활성화됩니다</li>
            </ul>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* 텍스트 레벨업 알림 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Icon icon="solar:chat-line-bold" className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">텍스트 레벨업 알림</h2>
            </div>

            {/* 텍스트 알림 활성화 카드 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 animate-fade-up">
              <div className="p-6">
                <FormField
                  control={form.control}
                  name="textLevelUpNotificationEnabled"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <Icon icon="solar:bell-bold" className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">텍스트 레벨업 알림</h3>
                          <p className="text-sm text-white/50">텍스트 레벨업 시 알림 메시지를 전송합니다</p>
                        </div>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>
            </div>

            {/* 텍스트 알림 채널 & 메시지 카드 */}
            <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden animate-fade-up transition-opacity ${!form.watch("textLevelUpNotificationEnabled") ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="p-6 border-b border-white/10">
                <FormField
                  control={form.control}
                  name="textLevelUpChannelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">알림 채널</FormLabel>
                      <ChannelSelect field={field} disabled={!form.watch("textLevelUpNotificationEnabled")} />
                      <FormDescription className="text-white/40">
                        비워두면 텍스트 레벨업 알림이 비활성화됩니다.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="p-6 space-y-4">
                <FormField
                  control={form.control}
                  name="textLevelUpMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">메시지 템플릿</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={defaultTextMessage}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className="min-h-20 border-white/10 bg-white/5 hover:bg-white/10 transition-colors resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 미리보기 */}
                <div>
                  <p className="mb-2 text-sm font-medium text-white/70">미리보기</p>
                  <div className="relative rounded-xl border border-white/10 bg-[#313338] p-3 overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                    <p className="text-sm text-[#dbdee1] pl-3">
                      {parseDiscordMarkdown(
                        (form.watch("textLevelUpMessage") ?? defaultTextMessage)
                          .replace("{user}", "@사용자")
                          .replace("{username}", "사용자")
                          .replace("{level}", "5")
                          .replace("{xp}", "2,500")
                          .replace("{server}", "서버 이름")
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 음성 레벨업 알림 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Icon icon="solar:microphone-3-bold" className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">음성 레벨업 알림</h2>
            </div>

            {/* 음성 알림 활성화 카드 */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 animate-fade-up">
              <div className="p-6">
                <FormField
                  control={form.control}
                  name="voiceLevelUpNotificationEnabled"
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                          <Icon icon="solar:bell-bold" className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">음성 레벨업 알림</h3>
                          <p className="text-sm text-white/50">음성 레벨업 시 알림 메시지를 전송합니다</p>
                        </div>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>
            </div>

            {/* 음성 알림 채널 & 메시지 카드 */}
            <div className={`bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden animate-fade-up transition-opacity ${!form.watch("voiceLevelUpNotificationEnabled") ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="p-6 border-b border-white/10">
                <FormField
                  control={form.control}
                  name="voiceLevelUpChannelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">알림 채널</FormLabel>
                      <ChannelSelect field={field} disabled={!form.watch("voiceLevelUpNotificationEnabled")} />
                      <FormDescription className="text-white/40">
                        비워두면 음성 레벨업 알림이 비활성화됩니다.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="p-6 space-y-4">
                <FormField
                  control={form.control}
                  name="voiceLevelUpMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">메시지 템플릿</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={defaultVoiceMessage}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          className="min-h-20 border-white/10 bg-white/5 hover:bg-white/10 transition-colors resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 미리보기 */}
                <div>
                  <p className="mb-2 text-sm font-medium text-white/70">미리보기</p>
                  <div className="relative rounded-xl border border-white/10 bg-[#313338] p-3 overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-emerald-500" />
                    <p className="text-sm text-[#dbdee1] pl-3">
                      {parseDiscordMarkdown(
                        (form.watch("voiceLevelUpMessage") ?? defaultVoiceMessage)
                          .replace("{user}", "@사용자")
                          .replace("{username}", "사용자")
                          .replace("{level}", "5")
                          .replace("{xp}", "2,500")
                          .replace("{server}", "서버 이름")
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 사용 가능한 변수 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 animate-fade-up">
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

          <div className="flex justify-end animate-fade-up">
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
