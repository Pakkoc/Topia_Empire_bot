"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  useGameSettings,
  useGameCategories,
  useCreateGamePanel,
  useUpdateGameSettings,
  useCreateGameCategory,
  useUpdateGameCategory,
  useDeleteGameCategory,
  useTextChannels,
  useCurrencySettings,
  useRoles,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";

export default function GameCenterPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  // 패널 채널 선택
  const [selectedChannelId, setSelectedChannelId] = useState("");

  // 게임 설정
  const [managerRoleId, setManagerRoleId] = useState<string | null>(null);
  const [entryFee, setEntryFee] = useState("100");
  const [rank1Percent, setRank1Percent] = useState("50");
  const [rank2Percent, setRank2Percent] = useState("30");
  const [rank3Percent, setRank3Percent] = useState("15");
  const [rank4Percent, setRank4Percent] = useState("5");

  // 새 카테고리
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryTeamCount, setNewCategoryTeamCount] = useState("2");
  const [newCategoryMaxPlayers, setNewCategoryMaxPlayers] = useState("");
  const [newCategoryWinnerTakesAll, setNewCategoryWinnerTakesAll] = useState(true);
  const [newCategoryUseCustomRewards, setNewCategoryUseCustomRewards] = useState(false);
  const [newCategoryRankRewards, setNewCategoryRankRewards] = useState<{ rank: number; percent: string }[]>([
    { rank: 1, percent: "50" },
    { rank: 2, percent: "30" },
    { rank: 3, percent: "15" },
    { rank: 4, percent: "5" },
  ]);

  const { data: currencySettings } = useCurrencySettings(guildId);
  const { data: settings, isLoading } = useGameSettings(guildId);
  const { data: categories } = useGameCategories(guildId);
  const { data: channels } = useTextChannels(guildId);
  const { data: roles } = useRoles(guildId);
  const createPanelMutation = useCreateGamePanel(guildId);
  const updateSettingsMutation = useUpdateGameSettings(guildId);
  const createCategoryMutation = useCreateGameCategory(guildId);
  const updateCategoryMutation = useUpdateGameCategory(guildId);
  const deleteCategoryMutation = useDeleteGameCategory(guildId);

  const topyName = currencySettings?.topyName ?? "토피";

  // 설정 초기화
  useEffect(() => {
    if (settings) {
      if (settings.channelId) {
        setSelectedChannelId(settings.channelId);
      }
      setManagerRoleId(settings.managerRoleId);
      setEntryFee(settings.entryFee);
      // rankRewards 객체에서 1-4등 비율 추출
      const rewards = settings.rankRewards || { 1: 50, 2: 30, 3: 15, 4: 5 };
      setRank1Percent(String(rewards[1] ?? 50));
      setRank2Percent(String(rewards[2] ?? 30));
      setRank3Percent(String(rewards[3] ?? 15));
      setRank4Percent(String(rewards[4] ?? 5));
    }
  }, [settings]);

  const handleCreatePanel = async () => {
    if (!selectedChannelId) {
      toast({ title: "채널을 선택해주세요.", variant: "destructive" });
      return;
    }

    try {
      await createPanelMutation.mutateAsync(selectedChannelId);
      toast({ title: "내전 패널이 설치되었습니다!" });
    } catch {
      toast({ title: "패널 설치에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleSaveSettings = async () => {
    const r1 = parseInt(rank1Percent) || 0;
    const r2 = parseInt(rank2Percent) || 0;
    const r3 = parseInt(rank3Percent) || 0;
    const r4 = parseInt(rank4Percent) || 0;
    const total = r1 + r2 + r3 + r4;

    if (total !== 100) {
      toast({
        title: `순위 비율의 합계는 100%여야 합니다. 현재: ${total}%`,
        variant: "destructive",
      });
      return;
    }

    try {
      await updateSettingsMutation.mutateAsync({
        managerRoleId,
        entryFee,
        rankRewards: { 1: r1, 2: r2, 3: r3, 4: r4 },
      });
      toast({ title: "설정이 저장되었습니다!" });
    } catch {
      toast({ title: "설정 저장에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleAddRank = () => {
    const nextRank = newCategoryRankRewards.length + 1;
    setNewCategoryRankRewards([...newCategoryRankRewards, { rank: nextRank, percent: "0" }]);
  };

  const handleRemoveRank = (index: number) => {
    if (newCategoryRankRewards.length <= 1) return;
    const updated = newCategoryRankRewards.filter((_, i) => i !== index);
    // Re-number ranks
    setNewCategoryRankRewards(updated.map((r, i) => ({ ...r, rank: i + 1 })));
  };

  const handleRankPercentChange = (index: number, percent: string) => {
    const updated = [...newCategoryRankRewards];
    const current = updated[index];
    if (current) {
      updated[index] = { rank: current.rank, percent };
      setNewCategoryRankRewards(updated);
    }
  };

  const getRankRewardsTotal = () => {
    return newCategoryRankRewards.reduce((sum, r) => sum + (parseInt(r.percent) || 0), 0);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: "카테고리 이름을 입력해주세요.", variant: "destructive" });
      return;
    }

    const teamCount = parseInt(newCategoryTeamCount) || 2;

    // 커스텀 보상 사용 시 합계 검증
    if (newCategoryUseCustomRewards) {
      const total = getRankRewardsTotal();
      if (total !== 100) {
        toast({ title: `순위 비율의 합계는 100%여야 합니다. 현재: ${total}%`, variant: "destructive" });
        return;
      }
    }

    // rankRewards 객체 생성
    let rankRewards: Record<number, number> | undefined;
    if (newCategoryUseCustomRewards) {
      rankRewards = {};
      newCategoryRankRewards.forEach(r => {
        rankRewards![r.rank] = parseInt(r.percent) || 0;
      });
    }

    try {
      await createCategoryMutation.mutateAsync({
        name: newCategoryName.trim(),
        teamCount,
        maxPlayersPerTeam: newCategoryMaxPlayers ? parseInt(newCategoryMaxPlayers) : null,
        winnerTakesAll: teamCount === 2 ? newCategoryWinnerTakesAll : undefined,
        rankRewards,
      });
      setNewCategoryName("");
      setNewCategoryTeamCount("2");
      setNewCategoryMaxPlayers("");
      setNewCategoryWinnerTakesAll(true);
      setNewCategoryUseCustomRewards(false);
      setNewCategoryRankRewards([
        { rank: 1, percent: "50" },
        { rank: 2, percent: "30" },
        { rank: 3, percent: "15" },
        { rank: 4, percent: "5" },
      ]);
      toast({ title: "카테고리가 생성되었습니다!" });
    } catch {
      toast({ title: "카테고리 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleToggleCategory = async (categoryId: number, enabled: boolean) => {
    try {
      await updateCategoryMutation.mutateAsync({ id: categoryId, enabled });
    } catch {
      toast({ title: "카테고리 변경에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await deleteCategoryMutation.mutateAsync(categoryId);
      toast({ title: "카테고리가 삭제되었습니다." });
    } catch {
      toast({ title: "카테고리 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">내전 시스템</h1>
        <p className="text-white/50 mt-1">
          참가비 기반 내전 게임을 생성하고 관리합니다
        </p>
      </div>

      {/* 내전 시스템 안내 */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl border border-violet-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:gamepad-bold" className="h-5 w-5 text-violet-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-white">내전 시스템 안내</h3>
            <ul className="text-sm text-white/60 space-y-1">
              <li>• <strong className="text-white/80">관리자</strong>가 패널에서 내전을 생성합니다</li>
              <li>• 유저들이 <strong className="text-white/80">참가비</strong>를 내고 참가합니다</li>
              <li>• 관리자가 참가자들을 <strong className="text-white/80">팀별로 배정</strong>합니다</li>
              <li>• 경기 종료 후 관리자가 <strong className="text-white/80">순위를 입력</strong>하면 자동 보상</li>
              <li>• 순위별로 상금풀의 일정 비율을 <strong className="text-white/80">팀원끼리 균등 분배</strong></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Panel Setup */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Icon icon="solar:widget-add-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">내전 패널 설치</h3>
            <p className="text-white/50 text-sm">디스코드 채널에 내전 패널을 설치합니다</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedChannelId || undefined}
            onValueChange={setSelectedChannelId}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white sm:w-64">
              <SelectValue placeholder="채널 선택...">
                {selectedChannelId && channels?.find(c => c.id === selectedChannelId)
                  ? `# ${channels.find(c => c.id === selectedChannelId)?.name}`
                  : selectedChannelId
                    ? "로딩 중..."
                    : "채널 선택..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {channels?.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  # {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleCreatePanel}
            disabled={!selectedChannelId || createPanelMutation.isPending}
            className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
          >
            {createPanelMutation.isPending ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                설치 중...
              </>
            ) : settings?.channelId === selectedChannelId && settings?.messageId ? (
              <>
                <Icon icon="solar:refresh-bold" className="h-4 w-4 mr-2" />
                패널 갱신
              </>
            ) : (
              <>
                <Icon icon="solar:add-circle-bold" className="h-4 w-4 mr-2" />
                패널 설치
              </>
            )}
          </Button>
        </div>
        <p className="text-white/40 text-xs mt-2">
          {settings?.channelId && settings?.messageId
            ? "패널이 설치되어 있습니다. 다른 채널을 선택하면 기존 패널은 삭제됩니다."
            : "선택한 채널에 내전 패널이 생성됩니다. 관리자가 버튼을 눌러 내전을 생성할 수 있습니다."}
        </p>
      </div>

      {/* 관리 역할 설정 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Icon icon="solar:shield-user-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">관리 역할 설정</h3>
            <p className="text-white/50 text-sm">내전 생성/팀배정/결과 입력 권한을 가진 역할을 지정합니다</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={managerRoleId || "__none__"}
            onValueChange={(value) => setManagerRoleId(value === "__none__" ? null : value)}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white sm:w-64">
              <SelectValue placeholder="역할 선택..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">없음 (서버 관리 권한만)</SelectItem>
              {roles?.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: `#${role.color.toString(16).padStart(6, "0")}`,
                      }}
                    />
                    @{role.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-white/40 text-xs mt-2">
          {managerRoleId
            ? "선택한 역할 또는 서버 관리 권한을 가진 유저가 내전을 관리할 수 있습니다."
            : "서버 관리 권한을 가진 유저만 내전을 관리할 수 있습니다."}
        </p>
      </div>

      {/* 참가비 및 보상 설정 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Icon icon="solar:wallet-money-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">참가비 및 보상 설정</h3>
            <p className="text-white/50 text-sm">참가비와 순위별 보상 비율을 설정합니다</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* 참가비 */}
          <div>
            <label className="text-white/70 text-sm block mb-2">참가비 ({topyName})</label>
            <Input
              type="number"
              min="0"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-amber-500/50 w-full sm:w-48"
            />
            <p className="text-xs text-white/40 mt-1">참가 시 차감되는 금액 (0이면 무료)</p>
          </div>

          {/* 순위별 보상 비율 */}
          <div>
            <label className="text-white/70 text-sm block mb-2">순위별 보상 비율 (%)</label>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🥇</span>
                  <span className="text-white/70 text-sm">1등</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={rank1Percent}
                  onChange={(e) => setRank1Percent(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🥈</span>
                  <span className="text-white/70 text-sm">2등</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={rank2Percent}
                  onChange={(e) => setRank2Percent(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🥉</span>
                  <span className="text-white/70 text-sm">3등</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={rank3Percent}
                  onChange={(e) => setRank3Percent(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">4️⃣</span>
                  <span className="text-white/70 text-sm">4등</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={rank4Percent}
                  onChange={(e) => setRank4Percent(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                />
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">
              합계: {(parseInt(rank1Percent) || 0) + (parseInt(rank2Percent) || 0) + (parseInt(rank3Percent) || 0) + (parseInt(rank4Percent) || 0)}% (100%가 되어야 합니다)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex-1 mr-4">
            <div className="flex items-start gap-2">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300/70">
                예: 참가자 10명, 참가비 100 {topyName} → 상금풀 1000 {topyName}<br />
                1등팀 (2명): 500 {topyName} ÷ 2 = 250 {topyName}/인
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {updateSettingsMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>

      {/* 카테고리 관리 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Icon icon="solar:tag-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">게임 카테고리</h3>
            <p className="text-white/50 text-sm">내전 생성 시 선택할 수 있는 카테고리를 관리합니다</p>
          </div>
        </div>

        {/* 새 카테고리 추가 */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="카테고리 이름 (예: 발로란트)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-emerald-500/50 sm:w-48"
            />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="팀 수"
                value={newCategoryTeamCount}
                onChange={(e) => setNewCategoryTeamCount(e.target.value)}
                min="2"
                max="100"
                className="bg-white/5 border-white/10 text-white focus:border-emerald-500/50 w-20"
              />
              <span className="text-white/50 text-sm">팀</span>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="인원"
                value={newCategoryMaxPlayers}
                onChange={(e) => setNewCategoryMaxPlayers(e.target.value)}
                min="1"
                max="25"
                className="bg-white/5 border-white/10 text-white focus:border-emerald-500/50 w-20"
              />
              <span className="text-white/50 text-sm">명/팀</span>
            </div>
            <Button
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {createCategoryMutation.isPending ? "추가 중..." : "카테고리 추가"}
            </Button>
          </div>
          {/* 2팀 승자독식 옵션 */}
          {newCategoryTeamCount === "2" && !newCategoryUseCustomRewards && (
            <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newCategoryWinnerTakesAll}
                onChange={(e) => setNewCategoryWinnerTakesAll(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50"
              />
              2팀 승자 독식 (1등 100%, 2등 0%)
            </label>
          )}

          {/* 커스텀 보상 설정 토글 */}
          <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={newCategoryUseCustomRewards}
              onChange={(e) => setNewCategoryUseCustomRewards(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/50"
            />
            커스텀 순위 보상 설정
          </label>

          {/* 커스텀 보상 입력 UI */}
          {newCategoryUseCustomRewards && (
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">순위별 보상 비율</span>
                <span className={`text-xs ${getRankRewardsTotal() === 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                  합계: {getRankRewardsTotal()}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {newCategoryRankRewards.map((reward, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <span className="text-white/50 text-xs w-6">{reward.rank}등</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={reward.percent}
                      onChange={(e) => handleRankPercentChange(index, e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm h-8 w-16"
                    />
                    <span className="text-white/50 text-xs">%</span>
                    {newCategoryRankRewards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRank(index)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Icon icon="solar:close-circle-linear" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRank}
                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Icon icon="solar:add-circle-linear" className="h-4 w-4 mr-1" />
                순위 추가
              </Button>

              <p className="text-white/40 text-xs">
                예: 배그 10등까지 → 1등 30%, 2등 20%, 3등 15%, ... 순위 추가해서 설정
              </p>
            </div>
          )}
        </div>

        {/* 카테고리 목록 */}
        <div className="space-y-2">
          {categories && categories.length > 0 ? (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between bg-white/5 rounded-xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Icon icon="solar:gamepad-linear" className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{category.name}</p>
                    <p className="text-white/40 text-xs">
                      {category.teamCount}팀
                      {category.maxPlayersPerTeam && ` · 팀당 ${category.maxPlayersPerTeam}명`}
                      {category.teamCount === 2 && category.winnerTakesAll && " · 승자독식"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={category.enabled}
                    onCheckedChange={(checked) => handleToggleCategory(category.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={deleteCategoryMutation.isPending}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-white/40">
              <Icon icon="solar:box-linear" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>등록된 카테고리가 없습니다</p>
              <p className="text-xs mt-1">카테고리를 추가하면 내전 생성 시 선택할 수 있습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
