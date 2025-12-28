"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  useGameSettings,
  useCreateGamePanel,
  useUpdateGameSettings,
  useTextChannels,
  useCurrencySettings,
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
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";

export default function GameCenterPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  // 패널 채널 선택
  const [selectedChannelId, setSelectedChannelId] = useState("");

  // 게임 설정
  const [betFeePercent, setBetFeePercent] = useState("20");
  const [minBet, setMinBet] = useState("100");
  const [maxBet, setMaxBet] = useState("10000");

  const { data: currencySettings } = useCurrencySettings(guildId);
  const { data: settings, isLoading } = useGameSettings(guildId);
  const { data: channels } = useTextChannels(guildId);
  const createPanelMutation = useCreateGamePanel(guildId);
  const updateSettingsMutation = useUpdateGameSettings(guildId);

  const topyName = currencySettings?.topyName ?? "토피";

  // 설정 초기화
  useEffect(() => {
    if (settings) {
      if (settings.channelId) {
        setSelectedChannelId(settings.channelId);
      }
      setBetFeePercent(String(settings.betFeePercent));
      setMinBet(settings.minBet);
      setMaxBet(settings.maxBet);
    }
  }, [settings]);

  const handleCreatePanel = async () => {
    if (!selectedChannelId) {
      toast({ title: "채널을 선택해주세요.", variant: "destructive" });
      return;
    }

    try {
      await createPanelMutation.mutateAsync(selectedChannelId);
      toast({ title: "게임센터 패널이 설치되었습니다!" });
    } catch {
      toast({ title: "패널 설치에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        betFeePercent: parseFloat(betFeePercent) || 20,
        minBet,
        maxBet,
      });
      toast({ title: "설정이 저장되었습니다!" });
    } catch {
      toast({ title: "설정 저장에 실패했습니다.", variant: "destructive" });
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
        <h1 className="text-2xl md:text-3xl font-bold text-white">게임센터</h1>
        <p className="text-white/50 mt-1">
          내전 배팅 게임을 생성하고 관리합니다
        </p>
      </div>

      {/* 게임센터 안내 */}
      <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl border border-violet-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:gamepad-bold" className="h-5 w-5 text-violet-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-white">게임센터 안내</h3>
            <ul className="text-sm text-white/60 space-y-1">
              <li>• <strong className="text-white/80">관리자</strong>가 패널에서 배팅 게임을 생성합니다</li>
              <li>• 유저들이 <strong className="text-white/80">A팀 / B팀</strong>에 {topyName}를 걸고 참여합니다</li>
              <li>• 배당률은 배팅 풀에 따라 <strong className="text-white/80">실시간</strong>으로 변동됩니다</li>
              <li>• 게임 종료 후 관리자가 <strong className="text-white/80">승자를 선택</strong>하면 자동 정산됩니다</li>
              <li>• 정산된 메시지는 <strong className="text-white/80">10분 후 자동 삭제</strong>됩니다</li>
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
            <h3 className="font-semibold text-white">게임센터 패널 설치</h3>
            <p className="text-white/50 text-sm">디스코드 채널에 게임센터 패널을 설치합니다</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedChannelId}
            onValueChange={setSelectedChannelId}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white sm:w-64">
              <SelectValue placeholder="채널 선택..." />
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
            : "선택한 채널에 게임센터 패널이 생성됩니다. 관리자가 버튼을 눌러 배팅을 생성할 수 있습니다."}
        </p>
      </div>

      {/* 게임 설정 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Icon icon="solar:settings-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">게임 설정</h3>
            <p className="text-white/50 text-sm">배팅 수수료 및 제한 금액을 설정합니다</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div>
            <label className="text-white/70 text-sm block mb-2">수수료 (%)</label>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={betFeePercent}
              onChange={(e) => setBetFeePercent(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
            />
            <p className="text-xs text-white/40 mt-1">당첨금에서 차감되는 수수료</p>
          </div>
          <div>
            <label className="text-white/70 text-sm block mb-2">최소 배팅 ({topyName})</label>
            <Input
              type="number"
              min="1"
              value={minBet}
              onChange={(e) => setMinBet(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
            />
            <p className="text-xs text-white/40 mt-1">한 번에 배팅 가능한 최소 금액</p>
          </div>
          <div>
            <label className="text-white/70 text-sm block mb-2">최대 배팅 ({topyName})</label>
            <Input
              type="number"
              min="1"
              value={maxBet}
              onChange={(e) => setMaxBet(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-amber-500/50"
            />
            <p className="text-xs text-white/40 mt-1">한 번에 배팅 가능한 최대 금액</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex-1 mr-4">
            <div className="flex items-start gap-2">
              <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300/70">
                수수료는 당첨 시에만 적용됩니다. 예: 100 {topyName} 당첨 시 20% 수수료 → 80 {topyName} 지급
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

      {/* 배당률 설명 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Icon icon="solar:calculator-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">배당률 계산 방식</h3>
            <p className="text-white/50 text-sm">토토 방식의 동적 배당률</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 rounded-xl p-4">
            <h4 className="text-white font-medium mb-2">배당률 공식</h4>
            <code className="text-emerald-400 text-sm bg-black/30 px-3 py-1 rounded">
              배당률 = 전체 풀 ÷ 해당 팀 풀
            </code>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
              <h5 className="text-blue-400 font-medium mb-2">예시: A팀 배당률</h5>
              <div className="text-sm text-white/60 space-y-1">
                <p>• 전체 풀: 10,000 {topyName}</p>
                <p>• A팀 풀: 2,000 {topyName}</p>
                <p>• B팀 풀: 8,000 {topyName}</p>
                <p className="text-blue-300 font-medium pt-2">→ A팀 배당률: 5.0배</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 rounded-xl p-4">
              <h5 className="text-rose-400 font-medium mb-2">예시: B팀 배당률</h5>
              <div className="text-sm text-white/60 space-y-1">
                <p>• 전체 풀: 10,000 {topyName}</p>
                <p>• A팀 풀: 2,000 {topyName}</p>
                <p>• B팀 풀: 8,000 {topyName}</p>
                <p className="text-rose-300 font-medium pt-2">→ B팀 배당률: 1.25배</p>
              </div>
            </div>
          </div>

          <p className="text-white/40 text-xs">
            * 배당률이 높을수록 해당 팀에 배팅한 사람이 적다는 의미입니다.
            당첨 시 배팅금 × 배당률 - 수수료만큼 지급됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
