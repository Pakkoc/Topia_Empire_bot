"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useXpExclusions,
  useCreateXpExclusionBulk,
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
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Hash, Shield, Volume2 } from "lucide-react";

// 채널 타입 상수
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_VOICE = 2;
const CHANNEL_TYPE_ANNOUNCEMENT = 5;
const CHANNEL_TYPE_STAGE_VOICE = 13;
const CHANNEL_TYPE_FORUM = 15;

// 채널이 음성 채널인지 확인
const isVoiceChannel = (type: number) =>
  type === CHANNEL_TYPE_VOICE || type === CHANNEL_TYPE_STAGE_VOICE;

export default function XpExclusionsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [targetType, setTargetType] = useState<"channel" | "role">("channel");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: exclusions, isLoading } = useXpExclusions(guildId);
  const { data: channels, isLoading: channelsLoading } = useChannels(guildId, null);
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);

  const createExclusionBulk = useCreateXpExclusionBulk(guildId);
  const deleteExclusion = useDeleteXpExclusion(guildId);

  // 텍스트/음성 채널만 필터링 (카테고리 제외)
  const filteredChannels = channels?.filter(
    (ch) =>
      ch.type === CHANNEL_TYPE_TEXT ||
      ch.type === CHANNEL_TYPE_VOICE ||
      ch.type === CHANNEL_TYPE_ANNOUNCEMENT ||
      ch.type === CHANNEL_TYPE_STAGE_VOICE ||
      ch.type === CHANNEL_TYPE_FORUM
  );

  // 이미 추가된 항목 제외
  const existingChannelIds = new Set(
    exclusions?.filter((e) => e.targetType === "channel").map((e) => e.targetId) ?? []
  );
  const existingRoleIds = new Set(
    exclusions?.filter((e) => e.targetType === "role").map((e) => e.targetId) ?? []
  );

  // 채널 옵션 (이미 추가된 것 제외)
  const channelOptions: MultiSelectOption[] = (filteredChannels ?? [])
    .filter((ch) => !existingChannelIds.has(ch.id))
    .map((ch) => ({
      value: ch.id,
      label: ch.name,
      icon: isVoiceChannel(ch.type) ? (
        <Volume2 className="h-4 w-4 text-green-400" />
      ) : (
        <Hash className="h-4 w-4 text-slate-400" />
      ),
    }));

  // 역할 옵션 (이미 추가된 것 제외)
  const roleOptions: MultiSelectOption[] = (roles ?? [])
    .filter((r) => !existingRoleIds.has(r.id))
    .map((r) => ({
      value: r.id,
      label: r.name,
      color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
    }));

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "최소 하나 이상 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createExclusionBulk.mutateAsync({
        targetType,
        targetIds: selectedIds,
      });
      toast({
        title: "차단 추가 완료",
        description: `${selectedIds.length}개의 ${targetType === "channel" ? "채널" : "역할"}이 차단되었습니다.`,
      });
      setIsAdding(false);
      setSelectedIds([]);
    } catch {
      toast({
        title: "추가 실패",
        description: "일부 항목이 이미 존재하거나 오류가 발생했습니다.",
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

  const getChannel = (id: string) => channels?.find((c) => c.id === id);
  const getChannelName = (id: string) => getChannel(id)?.name ?? id;
  const getRoleName = (id: string) => roles?.find((r) => r.id === id)?.name ?? id;

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

      {/* Add New Exclusion Form - Multi Select */}
      {isAdding && (
        <Card className="border-indigo-500/50 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">새 차단 항목 추가</CardTitle>
            <CardDescription>
              차단할 채널 또는 역할을 여러 개 선택할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">유형</label>
                <Select
                  value={targetType}
                  onValueChange={(value: "channel" | "role") => {
                    setTargetType(value);
                    setSelectedIds([]);
                  }}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="channel">채널</SelectItem>
                    <SelectItem value="role">역할</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  {targetType === "channel" ? "채널 선택" : "역할 선택"}
                </label>
                <MultiSelect
                  options={targetType === "channel" ? channelOptions : roleOptions}
                  selected={selectedIds}
                  onChange={setSelectedIds}
                  placeholder={
                    targetType === "channel"
                      ? channelsLoading
                        ? "로딩 중..."
                        : "채널을 선택하세요"
                      : rolesLoading
                      ? "로딩 중..."
                      : "역할을 선택하세요"
                  }
                  isLoading={targetType === "channel" ? channelsLoading : rolesLoading}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setSelectedIds([]);
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createExclusionBulk.isPending || selectedIds.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {createExclusionBulk.isPending
                  ? "추가 중..."
                  : selectedIds.length > 0
                  ? `${selectedIds.length}개 추가`
                  : "추가"}
              </Button>
            </div>
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
