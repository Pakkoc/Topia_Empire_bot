"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useLevelChannels,
  useCreateLevelChannel,
  useDeleteLevelChannel,
  useChannels,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Unlock, Hash } from "lucide-react";

export default function LevelChannelsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [level, setLevel] = useState(5);
  const [selectedChannelId, setSelectedChannelId] = useState("");

  const { data: levelChannels, isLoading } = useLevelChannels(guildId);
  const { data: channels, isLoading: channelsLoading } = useChannels(guildId);
  const createLevelChannel = useCreateLevelChannel(guildId);
  const deleteLevelChannel = useDeleteLevelChannel(guildId);

  // Filter out channels that are already assigned
  const assignedChannelIds = new Set(levelChannels?.map((lc) => lc.channelId) ?? []);
  const availableChannels = (channels ?? []).filter((c) => !assignedChannelIds.has(c.id));

  const handleSubmit = async () => {
    if (!selectedChannelId) {
      toast({
        title: "선택 필요",
        description: "채널을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (level < 1 || level > 999) {
      toast({
        title: "레벨 오류",
        description: "레벨은 1~999 사이여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createLevelChannel.mutateAsync({
        level,
        channelId: selectedChannelId,
      });
      toast({
        title: "해금 채널 추가 완료",
        description: `레벨 ${level}에 채널이 추가되었습니다.`,
      });
      setIsAdding(false);
      setSelectedChannelId("");
      setLevel(5);
    } catch {
      toast({
        title: "추가 실패",
        description: "채널이 이미 다른 레벨에 연결되어 있거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLevelChannel.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "해금 채널이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "채널을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getChannel = (id: string) => channels?.find((c) => c.id === id);

  const sortedLevelChannels = [...(levelChannels ?? [])].sort((a, b) => a.level - b.level);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardContent className="py-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded bg-slate-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">해금 채널</h1>
          <p className="text-slate-400">특정 레벨 달성 시 접근 가능한 채널을 설정합니다.</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          해금 채널 추가
        </Button>
      </div>

      {/* Add New Level Channel Form */}
      {isAdding && (
        <Card className="border-indigo-500/50 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">새 해금 채널 추가</CardTitle>
            <CardDescription>
              특정 레벨에 도달하면 접근 가능한 채널을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">레벨</label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={level}
                  onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
                  className="border-slate-700 bg-slate-900"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">채널 선택</label>
                <Select
                  value={selectedChannelId}
                  onValueChange={setSelectedChannelId}
                >
                  <SelectTrigger className="border-slate-700 bg-slate-900">
                    <SelectValue placeholder={channelsLoading ? "로딩 중..." : "채널을 선택하세요"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-slate-400" />
                          {channel.name}
                        </div>
                      </SelectItem>
                    ))}
                    {availableChannels.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-slate-400">
                        사용 가능한 채널이 없습니다.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setSelectedChannelId("");
                  setLevel(5);
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createLevelChannel.isPending || !selectedChannelId}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {createLevelChannel.isPending ? "추가 중..." : "추가"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Level Channels List */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">해금 채널 목록</CardTitle>
          <CardDescription>레벨별 접근 가능 채널 설정</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedLevelChannels.length > 0 ? (
            <div className="space-y-3">
              {sortedLevelChannels.map((levelChannel) => {
                const channel = getChannel(levelChannel.channelId);
                return (
                  <div
                    key={levelChannel.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
                        <Unlock className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">
                            레벨 {levelChannel.level}
                          </span>
                          <Badge
                            variant="secondary"
                            className="bg-slate-700 text-slate-300"
                          >
                            <Hash className="mr-1 h-3 w-3" />
                            {channel?.name ?? levelChannel.channelId}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          레벨 {levelChannel.level} 달성 시 채널 접근 권한 부여
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(levelChannel.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Unlock className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">설정된 해금 채널이 없습니다.</p>
              <p className="text-sm text-slate-500">
                해금 채널을 추가하여 레벨업 보상으로 채널 접근 권한을 부여하세요.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
