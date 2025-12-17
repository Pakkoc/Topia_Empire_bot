"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings, useTextChannels } from "@/hooks/queries";
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
import { useEffect } from "react";
import { Bell, MessageSquare, Hash, Loader2 } from "lucide-react";

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

  const { data: settings, isLoading } = useXpSettings(guildId);
  const { data: channels, isLoading: channelsLoading } = useTextChannels(guildId);
  const updateSettings = useUpdateXpSettings(guildId);

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      levelUpChannelId: null,
      levelUpMessage: null,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        levelUpChannelId: settings.levelUpChannelId ?? "",
        levelUpMessage: settings.levelUpMessage ?? defaultMessage,
      });
    }
  }, [settings, form]);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div className="h-6 w-32 rounded bg-slate-700" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-slate-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">레벨업 알림</h1>
        <p className="text-slate-400">레벨업 시 발송되는 알림을 설정합니다.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bell className="h-5 w-5" />
                알림 채널
              </CardTitle>
              <CardDescription>레벨업 알림이 전송될 채널을 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="levelUpChannelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">채널</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger className="border-slate-700 bg-slate-900">
                          <SelectValue
                            placeholder={
                              channelsLoading ? "로딩 중..." : "채널 선택 (선택 안함 = 알림 비활성화)"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-slate-400">알림 비활성화</span>
                        </SelectItem>
                        {channelsLoading ? (
                          <SelectItem value="__loading__" disabled>
                            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                            로딩 중...
                          </SelectItem>
                        ) : channels && channels.length > 0 ? (
                          channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              <span className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-slate-400" />
                                {channel.name}
                              </span>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__empty__" disabled>
                            채널이 없습니다
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      비워두면 레벨업 알림이 비활성화됩니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageSquare className="h-5 w-5" />
                알림 메시지
              </CardTitle>
              <CardDescription>레벨업 시 전송될 메시지를 커스텀합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="levelUpMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">메시지 템플릿</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={defaultMessage}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        className="min-h-24 border-slate-700 bg-slate-900"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <p className="mb-2 text-sm font-medium text-white">사용 가능한 변수</p>
                <div className="flex flex-wrap gap-2">
                  {placeholders.map((p) => (
                    <div
                      key={p.name}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5"
                    >
                      <code className="text-sm text-indigo-400">{p.name}</code>
                      <span className="ml-2 text-sm text-slate-400">{p.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <p className="mb-2 text-sm font-medium text-white">미리보기</p>
                <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                  <p className="text-slate-300">
                    {(form.watch("levelUpMessage") ?? defaultMessage)
                      .replace("{user}", "@사용자")
                      .replace("{username}", "사용자")
                      .replace("{level}", "5")
                      .replace("{xp}", "2,500")
                      .replace("{server}", "서버 이름")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateSettings.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
