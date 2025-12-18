"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useLevelRewards,
  useCreateLevelRewardBulk,
  useUpdateLevelReward,
  useDeleteLevelReward,
  useRoles,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Trophy, Star } from "lucide-react";
import { LevelReward } from "@/types/xp";

export default function LevelRewardsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [level, setLevel] = useState(5);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [removeOnHigherLevel, setRemoveOnHigherLevel] = useState(false);

  const { data: rewards, isLoading } = useLevelRewards(guildId);
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);
  const createRewardBulk = useCreateLevelRewardBulk(guildId);
  const updateReward = useUpdateLevelReward(guildId);
  const deleteReward = useDeleteLevelReward(guildId);

  // 역할 옵션
  const roleOptions: MultiSelectOption[] = (roles ?? []).map((r) => ({
    value: r.id,
    label: r.name,
    color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
  }));

  const handleSubmit = async () => {
    if (selectedRoleIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "최소 하나 이상의 역할을 선택해주세요.",
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
      await createRewardBulk.mutateAsync({
        level,
        roleIds: selectedRoleIds,
        removeOnHigherLevel,
      });
      toast({
        title: "보상 추가 완료",
        description: `레벨 ${level}에 ${selectedRoleIds.length}개의 역할이 추가되었습니다.`,
      });
      setIsAdding(false);
      setSelectedRoleIds([]);
      setLevel(5);
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

  const handleDelete = async (id: number) => {
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
          <h1 className="text-2xl font-bold text-white">레벨 보상</h1>
          <p className="text-slate-400">특정 레벨 달성 시 지급할 역할을 설정합니다.</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          보상 추가
        </Button>
      </div>

      {/* Add New Reward Form - Multi Select */}
      {isAdding && (
        <Card className="border-indigo-500/50 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white">새 레벨 보상 추가</CardTitle>
            <CardDescription>
              레벨과 역할을 여러 개 선택할 수 있습니다.
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
                <label className="text-sm font-medium text-white">역할 선택</label>
                <MultiSelect
                  options={roleOptions}
                  selected={selectedRoleIds}
                  onChange={setSelectedRoleIds}
                  placeholder={rolesLoading ? "로딩 중..." : "역할을 선택하세요"}
                  isLoading={rolesLoading}
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border border-slate-700 p-4">
              <Switch
                checked={removeOnHigherLevel}
                onCheckedChange={setRemoveOnHigherLevel}
              />
              <div className="space-y-1 leading-none">
                <label className="text-sm font-medium text-white">
                  상위 레벨 달성 시 역할 제거
                </label>
                <p className="text-sm text-slate-400">
                  다음 레벨 보상을 받으면 이 역할을 제거합니다.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setSelectedRoleIds([]);
                  setLevel(5);
                  setRemoveOnHigherLevel(false);
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createRewardBulk.isPending || selectedRoleIds.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {createRewardBulk.isPending
                  ? "추가 중..."
                  : selectedRoleIds.length > 0
                  ? `${selectedRoleIds.length}개 추가`
                  : "추가"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rewards List */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">보상 목록</CardTitle>
          <CardDescription>설정된 레벨 보상 역할</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedRewards.length > 0 ? (
            <div className="space-y-3">
              {sortedRewards.map((reward) => {
                const role = getRole(reward.roleId);
                return (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20">
                        <Star className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white">
                            레벨 {reward.level}
                          </span>
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: role?.color
                                ? `#${role.color.toString(16).padStart(6, "0")}20`
                                : undefined,
                              color: role?.color
                                ? `#${role.color.toString(16).padStart(6, "0")}`
                                : undefined,
                              borderColor: role?.color
                                ? `#${role.color.toString(16).padStart(6, "0")}40`
                                : undefined,
                            }}
                          >
                            @{role?.name ?? reward.roleId}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          {reward.removeOnHigherLevel
                            ? "상위 레벨 달성 시 제거됨"
                            : "영구 역할"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={reward.removeOnHigherLevel}
                          onCheckedChange={() => handleToggleRemove(reward)}
                        />
                        <span className="text-sm text-slate-400">제거</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(reward.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Trophy className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">설정된 레벨 보상이 없습니다.</p>
              <p className="text-sm text-slate-500">
                레벨 보상을 추가하여 유저들에게 동기를 부여하세요.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
