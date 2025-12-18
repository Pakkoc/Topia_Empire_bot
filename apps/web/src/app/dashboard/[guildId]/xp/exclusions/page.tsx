"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useXpExclusions,
  useCreateXpExclusion,
  useDeleteXpExclusion,
  useChannels,
  useRoles,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Hash, Shield, Loader2, Volume2 } from "lucide-react";

const exclusionFormSchema = z.object({
  targetType: z.enum(["channel", "role"]),
  targetId: z.string().min(1, "선택해주세요"),
});

type ExclusionFormValues = z.infer<typeof exclusionFormSchema>;

export default function XpExclusionsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const { data: exclusions, isLoading } = useXpExclusions(guildId);
  const { data: channels, isLoading: channelsLoading } = useChannels(guildId, null); // 모든 채널 (텍스트 + 음성)
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);

  // 채널 타입 상수
  const CHANNEL_TYPE_TEXT = 0;
  const CHANNEL_TYPE_VOICE = 2;
  const CHANNEL_TYPE_ANNOUNCEMENT = 5;
  const CHANNEL_TYPE_STAGE_VOICE = 13;
  const CHANNEL_TYPE_FORUM = 15;

  // 텍스트/음성 채널만 필터링 (카테고리 제외)
  const filteredChannels = channels?.filter(
    (ch) =>
      ch.type === CHANNEL_TYPE_TEXT ||
      ch.type === CHANNEL_TYPE_VOICE ||
      ch.type === CHANNEL_TYPE_ANNOUNCEMENT ||
      ch.type === CHANNEL_TYPE_STAGE_VOICE ||
      ch.type === CHANNEL_TYPE_FORUM
  );

  // 채널이 음성 채널인지 확인
  const isVoiceChannel = (type: number) =>
    type === CHANNEL_TYPE_VOICE || type === CHANNEL_TYPE_STAGE_VOICE;
  const createExclusion = useCreateXpExclusion(guildId);
  const deleteExclusion = useDeleteXpExclusion(guildId);

  const form = useForm<ExclusionFormValues>({
    resolver: zodResolver(exclusionFormSchema),
    defaultValues: {
      targetType: "channel",
      targetId: "",
    },
  });

  const targetType = form.watch("targetType");

  const onSubmit = async (data: ExclusionFormValues) => {
    try {
      await createExclusion.mutateAsync(data);
      toast({
        title: "제외 항목 추가 완료",
        description: "새로운 제외 항목이 추가되었습니다.",
      });
      setIsAdding(false);
      form.reset();
    } catch {
      toast({
        title: "추가 실패",
        description: "이미 존재하는 항목이거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExclusion.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "제외 항목이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "항목을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const channelExclusions = exclusions?.filter((e) => e.targetType === "channel") ?? [];
  const roleExclusions = exclusions?.filter((e) => e.targetType === "role") ?? [];

  // Helper to get channel by ID
  const getChannel = (id: string) => {
    return channels?.find((c) => c.id === id);
  };

  const getChannelName = (id: string) => {
    return getChannel(id)?.name ?? id;
  };

  const getRoleName = (id: string) => {
    const role = roles?.find((r) => r.id === id);
    return role?.name ?? id;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse border-slate-700 bg-slate-800/50">
              <CardHeader>
                <div className="h-6 w-32 rounded bg-slate-700" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 rounded bg-slate-700" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">XP 차단</h1>
          <p className="text-slate-400">XP를 받을 수 없는 채널과 역할을 설정합니다.</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          차단 추가
        </Button>
      </div>

      {/* Add New Exclusion Form */}
      {isAdding && (
        <Card className="border-indigo-500/50 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">새 차단 항목 추가</CardTitle>
            <CardDescription>
              차단할 채널 또는 역할을 선택하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="targetType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">유형</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("targetId", "");
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="border-slate-700 bg-slate-900">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="channel">채널</SelectItem>
                            <SelectItem value="role">역할</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">
                          {targetType === "channel" ? "채널" : "역할"}
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-700 bg-slate-900">
                              <SelectValue
                                placeholder={
                                  targetType === "channel"
                                    ? channelsLoading
                                      ? "로딩 중..."
                                      : "채널 선택"
                                    : rolesLoading
                                    ? "로딩 중..."
                                    : "역할 선택"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {targetType === "channel" ? (
                              channelsLoading ? (
                                <SelectItem value="loading" disabled>
                                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                  로딩 중...
                                </SelectItem>
                              ) : filteredChannels && filteredChannels.length > 0 ? (
                                filteredChannels.map((channel) => (
                                  <SelectItem key={channel.id} value={channel.id}>
                                    <span className="flex items-center gap-2">
                                      {isVoiceChannel(channel.type) ? (
                                        <Volume2 className="h-4 w-4 text-green-400" />
                                      ) : (
                                        <Hash className="h-4 w-4 text-slate-400" />
                                      )}
                                      {channel.name}
                                    </span>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>
                                  채널이 없습니다
                                </SelectItem>
                              )
                            ) : rolesLoading ? (
                              <SelectItem value="loading" disabled>
                                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                로딩 중...
                              </SelectItem>
                            ) : roles && roles.length > 0 ? (
                              roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="h-3 w-3 rounded-full"
                                      style={{
                                        backgroundColor:
                                          role.color === 0
                                            ? "#99aab5"
                                            : `#${role.color.toString(16).padStart(6, "0")}`,
                                      }}
                                    />
                                    {role.name}
                                  </span>
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                역할이 없습니다
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false);
                      form.reset();
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={createExclusion.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createExclusion.isPending ? "추가 중..." : "추가"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Exclusions Lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channel Exclusions */}
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Hash className="h-5 w-5 text-blue-500" />
              차단된 채널
            </CardTitle>
            <CardDescription>이 채널에서는 XP를 받을 수 없습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {channelExclusions.length > 0 ? (
              <div className="space-y-2">
                {channelExclusions.map((exclusion) => {
                  const channel = getChannel(exclusion.targetId);
                  const isVoice = channel ? isVoiceChannel(channel.type) : false;
                  return (
                    <div
                      key={exclusion.id}
                      className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                    >
                      <div className="flex items-center gap-2">
                        {isVoice ? (
                          <Volume2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <Hash className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-slate-300">
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
                        onClick={() => handleDelete(exclusion.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Hash className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-400">차단된 채널이 없습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Exclusions */}
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5 text-purple-500" />
              차단된 역할
            </CardTitle>
            <CardDescription>이 역할을 가진 유저는 XP를 받을 수 없습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {roleExclusions.length > 0 ? (
              <div className="space-y-2">
                {roleExclusions.map((exclusion) => (
                  <div
                    key={exclusion.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">@{getRoleName(exclusion.targetId)}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(exclusion.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Shield className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-400">차단된 역할이 없습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
