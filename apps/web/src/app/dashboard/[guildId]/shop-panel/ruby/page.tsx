"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  useShopPanelSettingsByCurrency,
  useCreateRubyShopPanel,
  useTextChannels,
  useCurrencySettings,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";

export default function RubyShopPanelPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  const [selectedChannelId, setSelectedChannelId] = useState("");

  const { data: currencySettings } = useCurrencySettings(guildId);
  const { data: settings, isLoading } = useShopPanelSettingsByCurrency(guildId, "ruby");
  const { data: channels } = useTextChannels(guildId);
  const createPanelMutation = useCreateRubyShopPanel(guildId);

  const rubyName = currencySettings?.rubyName ?? "루비";

  useEffect(() => {
    if (settings?.channelId) {
      setSelectedChannelId(settings.channelId);
    }
  }, [settings]);

  const handleCreatePanel = async () => {
    if (!selectedChannelId) {
      toast({ title: "채널을 선택해주세요.", variant: "destructive" });
      return;
    }

    try {
      await createPanelMutation.mutateAsync(selectedChannelId);
      toast({ title: `${rubyName} 상점 패널이 설치되었습니다!` });
    } catch {
      toast({ title: "패널 설치에 실패했습니다.", variant: "destructive" });
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
        <h1 className="text-2xl md:text-3xl font-bold text-white">{rubyName} 상점 패널</h1>
        <p className="text-white/50 mt-1">
          디스코드 채널에 {rubyName} 상점 패널을 설치합니다
        </p>
      </div>

      {/* 안내 */}
      <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 rounded-2xl border border-pink-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:diamond-bold" className="h-5 w-5 text-pink-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-white">{rubyName} 상점 안내</h3>
            <ul className="text-sm text-white/60 space-y-1">
              <li>• <strong className="text-white/80">{rubyName}</strong>로 구매 가능한 아이템만 표시됩니다</li>
              <li>• 유저가 버튼을 누르면 <strong className="text-white/80">아이템 목록</strong>이 표시됩니다</li>
              <li>• 아이템 선택 후 <strong className="text-white/80">수량을 입력</strong>하여 구매합니다</li>
              <li>• 구매 시 <strong className="text-white/80">{rubyName}</strong>가 즉시 차감됩니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Panel Setup */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Icon icon="solar:widget-add-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{rubyName} 상점 패널 설치</h3>
            <p className="text-white/50 text-sm">디스코드 채널에 {rubyName} 상점 패널을 설치합니다</p>
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
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
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
            : `선택한 채널에 ${rubyName} 상점 패널이 생성됩니다.`}
        </p>
      </div>

      {/* 상점 아이템 안내 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Icon icon="solar:bag-4-bold" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">상점 아이템 관리</h3>
            <p className="text-white/50 text-sm">{rubyName} 상점에 표시될 아이템을 관리합니다</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Icon icon="solar:info-circle-linear" className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-white/70">
                {rubyName} 상점에 표시될 아이템은 <strong className="text-white">화폐 시스템 → 상점</strong> 메뉴에서 관리할 수 있습니다.
              </p>
              <p className="text-sm text-white/50">
                아이템의 &quot;화폐 타입&quot;을 <strong className="text-white/70">{rubyName}</strong> 또는 <strong className="text-white/70">둘 다</strong>로 설정하면 이 패널에 표시됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
