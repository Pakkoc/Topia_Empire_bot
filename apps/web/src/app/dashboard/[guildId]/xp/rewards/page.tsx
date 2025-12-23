"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useLevelRewards,
  useCreateLevelRewardBulk,
  useUpdateLevelReward,
  useDeleteLevelReward,
  useLevelChannels,
  useCreateLevelChannel,
  useDeleteLevelChannel,
  useRoles,
  useChannels,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { useEffect } from "react";
import { Icon } from "@iconify/react";
import { LevelReward } from "@/types/xp";

export default function LevelRewardsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  // Role Rewards State
  const [rewardLevel, setRewardLevel] = useState(5);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [removeOnHigherLevel, setRemoveOnHigherLevel] = useState(false);

  const { data: rewards, isLoading: rewardsLoading } = useLevelRewards(guildId);
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);
  const createRewardBulk = useCreateLevelRewardBulk(guildId);
  const updateReward = useUpdateLevelReward(guildId);
  const deleteReward = useDeleteLevelReward(guildId);

  const roleOptions: MultiSelectOption[] = (roles ?? []).map((r) => ({
    value: r.id,
    label: r.name,
    color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
  }));

  const handleSubmitReward = async () => {
    if (selectedRoleIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "최소 하나 이상의 역할을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (rewardLevel < 1 || rewardLevel > 999) {
      toast({
        title: "레벨 오류",
        description: "레벨은 1~999 사이여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createRewardBulk.mutateAsync({
        level: rewardLevel,
        roleIds: selectedRoleIds,
        removeOnHigherLevel,
      });
      toast({
        title: "보상 추가 완료",
        description: `레벨 ${rewardLevel}에 ${selectedRoleIds.length}개의 역할이 추가되었습니다.`,
      });
      setSelectedRoleIds([]);
      setRewardLevel(5);
      setRemoveOnHigherLevel(false);
    } catch {
      toast({
        title: "추가 실패",
        description: "일부 보상이 이미 존재하거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleRemove = async (reward: LevelReward) => {
    try {
      await updateReward.mutateAsync({
        id: reward.id,
        data: { removeOnHigherLevel: !reward.removeOnHigherLevel },
      });
      toast({
        title: "설정 변경 완료",
        description: "역할 제거 설정이 변경되었습니다.",
      });
    } catch {
      toast({
        title: "변경 실패",
        description: "설정을 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReward = async (id: number) => {
    try {
      await deleteReward.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "레벨 보상이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "보상을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getRole = (id: string) => roles?.find((r) => r.id === id);
  const sortedRewards = [...(rewards ?? [])].sort((a, b) => a.level - b.level);

  // Level Channels State
  const [channelLevel, setChannelLevel] = useState(5);
  const [selectedChannelId, setSelectedChannelId] = useState("");

  // 폼에 값이 입력된 경우 unsaved changes로 표시
  useEffect(() => {
    const hasRewardFormData = selectedRoleIds.length > 0;
    const hasChannelFormData = selectedChannelId !== "";
    setHasUnsavedChanges(hasRewardFormData || hasChannelFormData);
  }, [selectedRoleIds, selectedChannelId, setHasUnsavedChanges]);

  const { data: levelChannels, isLoading: channelsLoading } = useLevelChannels(guildId);
  const { data: channels, isLoading: allChannelsLoading } = useChannels(guildId);
  const createLevelChannel = useCreateLevelChannel(guildId);
  const deleteLevelChannel = useDeleteLevelChannel(guildId);

  const assignedChannelIds = new Set(levelChannels?.map((lc) => lc.channelId) ?? []);
  const availableChannels = (channels ?? []).filter((c) => !assignedChannelIds.has(c.id));

  const handleSubmitChannel = async () => {
    if (!selectedChannelId) {
      toast({
        title: "선택 필요",
        description: "채널을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (channelLevel < 1 || channelLevel > 999) {
      toast({
        title: "레벨 오류",
        description: "레벨은 1~999 사이여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createLevelChannel.mutateAsync({
        level: channelLevel,
        channelId: selectedChannelId,
      });
      toast({
        title: "해금 채널 추가 완료",
        description: `레벨 ${channelLevel}에 채널이 추가되었습니다.`,
      });
      setSelectedChannelId("");
      setChannelLevel(5);
    } catch {
      toast({
        title: "추가 실패",
        description: "채널이 이미 다른 레벨에 연결되어 있거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteChannel = async (id: number) => {
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

  const isLoading = rewardsLoading || channelsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>

        {/* Tabs Skeleton */}
        <div className="h-12 w-64 animate-pulse rounded-xl bg-white/5" />

        {/* Card Skeleton */}
        <div className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
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
        <h1 className="text-2xl md:text-3xl font-bold text-white">레벨 보상</h1>
        <p className="text-white/50 mt-1">레벨 달성 시 지급할 역할과 해금 채널을 설정합니다.</p>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
          <TabsTrigger
            value="roles"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
          >
            <Icon icon="solar:cup-star-linear" className="mr-2 h-4 w-4" />
            역할 보상
          </TabsTrigger>
          <TabsTrigger
            value="channels"
            className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
          >
            <Icon icon="solar:lock-unlocked-linear" className="mr-2 h-4 w-4" />
            해금 채널
          </TabsTrigger>
        </TabsList>

        {/* 역할 보상 탭 */}
        <TabsContent value="roles" className="animate-fade-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rewards List */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Icon icon="solar:cup-star-bold" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">역할 보상 목록</h3>
                  <p className="text-sm text-white/50">레벨 달성 시 지급되는 역할</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {sortedRewards.length > 0 ? (
                <div className="space-y-3">
                  {sortedRewards.map((reward) => {
                    const role = getRole(reward.roleId);
                    return (
                      <div
                        key={reward.id}
                        className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                            <Icon icon="solar:star-bold" className="h-6 w-6 text-amber-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-bold text-white">
                                레벨 {reward.level}
                              </span>
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor: role?.color
                                    ? `#${role.color.toString(16).padStart(6, "0")}20`
                                    : 'rgba(255,255,255,0.1)',
                                  color: role?.color
                                    ? `#${role.color.toString(16).padStart(6, "0")}`
                                    : 'rgba(255,255,255,0.7)',
                                  borderColor: role?.color
                                    ? `#${role.color.toString(16).padStart(6, "0")}40`
                                    : 'rgba(255,255,255,0.2)',
                                }}
                              >
                                @{role?.name ?? reward.roleId}
                              </Badge>
                            </div>
                            <p className="text-sm text-white/40 mt-1">
                              {reward.removeOnHigherLevel
                                ? "상위 레벨 달성 시 제거됨"
                                : "영구 역할"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={reward.removeOnHigherLevel}
                              onCheckedChange={() => handleToggleRemove(reward)}
                            />
                            <span className="text-sm text-white/40">제거</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteReward(reward.id)}
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
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:cup-star-linear" className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/50">설정된 레벨 보상이 없습니다.</p>
                  <p className="text-sm text-white/30 mt-1">
                    레벨 보상을 추가하여 유저들에게 동기를 부여하세요.
                  </p>
                </div>
              )}
            </div>
          </div>

            {/* Add Reward Form */}
            <div className="relative z-20 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 h-fit">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Icon icon="solar:add-circle-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">보상 추가</h3>
                    <p className="text-sm text-white/50">레벨과 역할을 선택하세요</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70">레벨</label>
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    value={rewardLevel}
                    onChange={(e) => setRewardLevel(parseInt(e.target.value) || 1)}
                    className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70">역할 선택</label>
                  <MultiSelect
                    options={roleOptions}
                    selected={selectedRoleIds}
                    onChange={setSelectedRoleIds}
                    placeholder={rolesLoading ? "로딩 중..." : "역할을 선택하세요"}
                    isLoading={rolesLoading}
                  />
                </div>

                <div className="flex items-center space-x-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <Switch
                    checked={removeOnHigherLevel}
                    onCheckedChange={setRemoveOnHigherLevel}
                  />
                  <div className="space-y-1 leading-none">
                    <label className="text-sm font-medium text-white">
                      상위 레벨 달성 시 역할 제거
                    </label>
                    <p className="text-sm text-white/40">
                      다음 레벨 보상을 받으면 이 역할을 제거합니다.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSubmitReward}
                  disabled={createRewardBulk.isPending || selectedRoleIds.length === 0}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white"
                >
                  {createRewardBulk.isPending
                    ? "추가 중..."
                    : selectedRoleIds.length > 0
                    ? `${selectedRoleIds.length}개 추가`
                    : "추가"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 해금 채널 탭 */}
        <TabsContent value="channels" className="animate-fade-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Level Channels List */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Icon icon="solar:lock-unlocked-bold" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">해금 채널 목록</h3>
                  <p className="text-sm text-white/50">레벨별 접근 가능 채널 설정</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {sortedLevelChannels.length > 0 ? (
                <div className="space-y-3">
                  {sortedLevelChannels.map((levelChannel) => {
                    const channel = getChannel(levelChannel.channelId);
                    return (
                      <div
                        key={levelChannel.id}
                        className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                            <Icon icon="solar:lock-unlocked-bold" className="h-6 w-6 text-green-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-bold text-white">
                                레벨 {levelChannel.level}
                              </span>
                              <Badge
                                variant="secondary"
                                className="bg-white/10 text-white/70"
                              >
                                <Icon icon="solar:hashtag-linear" className="mr-1 h-3 w-3" />
                                {channel?.name ?? levelChannel.channelId}
                              </Badge>
                            </div>
                            <p className="text-sm text-white/40 mt-1">
                              레벨 {levelChannel.level} 달성 시 채널 접근 권한 부여
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteChannel(levelChannel.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:lock-unlocked-linear" className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/50">설정된 해금 채널이 없습니다.</p>
                  <p className="text-sm text-white/30 mt-1">
                    해금 채널을 추가하여 레벨업 보상으로 채널 접근 권한을 부여하세요.
                  </p>
                </div>
              )}
            </div>
          </div>

            {/* Add Channel Form */}
            <div className="relative z-20 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 h-fit">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Icon icon="solar:add-circle-bold" className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">해금 채널 추가</h3>
                    <p className="text-sm text-white/50">레벨과 채널을 선택하세요</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70">레벨</label>
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    value={channelLevel}
                    onChange={(e) => setChannelLevel(parseInt(e.target.value) || 1)}
                    className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70">채널 선택</label>
                  <Select
                    value={selectedChannelId}
                    onValueChange={setSelectedChannelId}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                      <SelectValue placeholder={allChannelsLoading ? "로딩 중..." : "채널을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:hashtag-linear" className="h-4 w-4 text-white/40" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                      {availableChannels.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-white/40">
                          사용 가능한 채널이 없습니다.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSubmitChannel}
                  disabled={createLevelChannel.isPending || !selectedChannelId}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white"
                >
                  {createLevelChannel.isPending ? "추가 중..." : "추가"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
