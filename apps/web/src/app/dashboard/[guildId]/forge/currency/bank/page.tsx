"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTreasury, useCurrencySettings, useTextChannels, useRoles, useUpdateCurrencySettings } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@iconify/react";
import { apiClient } from "@/lib/remote/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// 국고 거래 타입 라벨
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  transfer_fee: "이체 수수료",
  shop_fee: "상점 수수료",
  tax: "월말 세금",
  admin_distribute: "관리자 지급",
};

// 은행 패널 설정 조회 훅
function useBankPanelSettings(guildId: string) {
  return useQuery({
    queryKey: ["bank-panel-settings", guildId],
    queryFn: async () => {
      const response = await apiClient.get<{
        channelId: string | null;
        messageId: string | null;
        bankName: string;
      }>(`/api/guilds/${guildId}/bank-panel`);
      return response.data;
    },
    enabled: !!guildId,
  });
}

// 은행 패널 설치 뮤테이션
function useCreateBankPanel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const response = await apiClient.post<{ success: boolean; messageId: string }>(
        `/api/guilds/${guildId}/bank-panel`,
        { channelId }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-panel-settings", guildId] });
      queryClient.invalidateQueries({ queryKey: ["treasury", guildId] });
    },
  });
}

// 은행 패널 삭제 뮤테이션
function useDeleteBankPanel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/api/guilds/${guildId}/bank-panel`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-panel-settings", guildId] });
    },
  });
}

export default function BankPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();

  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBankName, setEditingBankName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);

  // 데이터 조회
  const { data: treasury, isLoading: treasuryLoading } = useTreasury(guildId);
  const { data: settings } = useCurrencySettings(guildId);
  const { data: panelSettings, isLoading: panelLoading } = useBankPanelSettings(guildId);
  const { data: channels = [] } = useTextChannels(guildId);
  const { data: roles = [] } = useRoles(guildId);

  const createPanel = useCreateBankPanel(guildId);
  const deletePanel = useDeleteBankPanel(guildId);
  const updateSettings = useUpdateCurrencySettings(guildId);

  const topyName = settings?.topyName ?? "토피";
  const rubyName = settings?.rubyName ?? "루비";
  const bankName = settings?.bankName ?? "디토뱅크";

  // 은행 이름 초기화
  useEffect(() => {
    if (settings?.bankName) {
      setEditingBankName(settings.bankName);
    }
  }, [settings?.bankName]);

  // 은행 이름 저장 핸들러
  const handleSaveBankName = async () => {
    if (!editingBankName.trim()) {
      toast({
        title: "은행 이름을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    if (editingBankName.length > 20) {
      toast({
        title: "은행 이름은 20자 이내로 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateSettings.mutateAsync({ bankName: editingBankName.trim() });
      toast({
        title: "은행 이름이 변경되었습니다",
        description: `"${editingBankName.trim()}"으로 변경되었습니다.`,
      });
      setIsEditingName(false);
    } catch (error) {
      toast({
        title: "저장 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  // 숫자 포맷
  const formatNumber = (value: string | number | bigint) => {
    return BigInt(value).toLocaleString();
  };

  // 패널 설치 핸들러
  const handleInstallPanel = async () => {
    if (!selectedChannelId) {
      toast({
        title: "채널을 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPanel.mutateAsync(selectedChannelId);
      toast({
        title: "패널이 설치되었습니다",
        description: "선택한 채널에 디토뱅크 패널이 생성되었습니다.",
      });
      setSelectedChannelId("");
    } catch (error) {
      toast({
        title: "패널 설치 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  // 패널 삭제 핸들러
  const handleDeletePanel = async () => {
    try {
      await deletePanel.mutateAsync();
      toast({
        title: "패널이 삭제되었습니다",
      });
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "패널 삭제 실패",
        description: "다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  // 설치된 채널 이름 찾기
  const installedChannel = channels.find((ch) => ch.id === panelSettings?.channelId);

  if (treasuryLoading || panelLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="svg-spinners:ring-resize" className="w-8 h-8 text-white/50" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 - 은행 이름 편집 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <Icon icon="solar:bank-bold" className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            {isEditingName ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={editingBankName}
                    onChange={(e) => setEditingBankName(e.target.value)}
                    placeholder="은행 이름을 입력하세요"
                    className="bg-white/10 border-white/20 text-white text-xl font-bold h-10 max-w-xs"
                    maxLength={20}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveBankName();
                      if (e.key === "Escape") {
                        setIsEditingName(false);
                        setEditingBankName(bankName);
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveBankName}
                    disabled={updateSettings.isPending}
                    className="bg-emerald-500 hover:bg-emerald-600 h-10 px-4"
                  >
                    {updateSettings.isPending ? (
                      <Icon icon="svg-spinners:ring-resize" className="w-4 h-4" />
                    ) : (
                      <>
                        <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-1" />
                        저장
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingName(false);
                      setEditingBankName(bankName);
                    }}
                    className="border-white/20 text-white/70 hover:bg-white/10 h-10"
                  >
                    취소
                  </Button>
                </div>
                <p className="text-xs text-white/40">
                  Enter로 저장, Esc로 취소 (최대 20자)
                </p>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingBankName(bankName);
                  setIsEditingName(true);
                }}
                className="group text-left w-full"
              >
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {bankName}
                  </h1>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/0 group-hover:bg-white/10 transition-all">
                    <Icon icon="solar:pen-bold" className="w-4 h-4 text-white/30 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-xs text-white/30 group-hover:text-emerald-400 transition-colors">수정</span>
                  </div>
                </div>
                <p className="text-sm text-white/50 mt-1">
                  클릭하여 은행 이름을 변경할 수 있습니다
                </p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 페이지 설명 */}
      <p className="text-white/60 -mt-4">
        국고 현황을 확인하고 {bankName} 패널을 설치하여 멤버들이 금융 서비스를 이용할 수 있게 하세요.
      </p>

      {/* 국고 현황 카드 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <Icon icon="solar:vault-bold" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">국고 현황</h2>
            <p className="text-sm text-white/50">
              서버에서 발생한 수수료와 세금이 자동으로 적립됩니다
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 현재 잔액 */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon="solar:wallet-bold" className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium text-white/70">현재 잔액</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/60">{topyName}</span>
                <span className="text-xl font-bold text-white">
                  {formatNumber(treasury?.treasury.topyBalance ?? "0")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">{rubyName}</span>
                <span className="text-xl font-bold text-white">
                  {formatNumber(treasury?.treasury.rubyBalance ?? "0")}
                </span>
              </div>
            </div>
          </div>

          {/* 이번 달 수집량 */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Icon icon="solar:calendar-bold" className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-white/70">이번 달 수집량</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white/60">{topyName}</span>
                <span className="text-xl font-bold text-green-400">
                  +{formatNumber(treasury?.monthlyCollected.topy ?? "0")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">{rubyName}</span>
                <span className="text-xl font-bold text-green-400">
                  +{formatNumber(treasury?.monthlyCollected.ruby ?? "0")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 누적 통계 */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-sm font-medium text-white/70 mb-4">누적 통계</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">총 {topyName} 수집</div>
              <div className="text-sm font-semibold text-white">
                {formatNumber(treasury?.treasury.totalTopyCollected ?? "0")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">총 {rubyName} 수집</div>
              <div className="text-sm font-semibold text-white">
                {formatNumber(treasury?.treasury.totalRubyCollected ?? "0")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">총 {topyName} 지급</div>
              <div className="text-sm font-semibold text-white">
                {formatNumber(treasury?.treasury.totalTopyDistributed ?? "0")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 mb-1">총 {rubyName} 지급</div>
              <div className="text-sm font-semibold text-white">
                {formatNumber(treasury?.treasury.totalRubyDistributed ?? "0")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 수집 안내 */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-white/10 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">국고 수집 안내</h3>
            <p className="text-sm text-white/60 mb-3">
              다음 항목들이 자동으로 국고에 적립됩니다:
            </p>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-400" />
                <span><strong>이체 수수료</strong> - 유저 간 화폐 이체 시 발생하는 수수료</span>
              </li>
              <li className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-400" />
                <span><strong>상점 수수료</strong> - 상점에서 아이템 구매 시 발생하는 수수료</span>
              </li>
              <li className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-400" />
                <span><strong>월말 세금</strong> - 매월 말일에 부과되는 보유세</span>
              </li>
            </ul>
            <p className="text-xs text-white/40 mt-3">
              수수료율과 세금은 화폐 설정에서 변경할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 디토뱅크 패널 설치 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Icon icon="solar:widget-add-bold" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{bankName} 패널 설치</h2>
            <p className="text-sm text-white/50">
              채널에 패널을 설치하면 멤버들이 버튼으로 금융 서비스를 이용할 수 있습니다
            </p>
          </div>
        </div>

        {/* 현재 설치 상태 */}
        {panelSettings?.channelId ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-green-400" />
                <div>
                  <span className="text-white font-medium">패널이 설치되어 있습니다</span>
                  <p className="text-sm text-white/60">
                    채널: #{installedChannel?.name ?? panelSettings.channelId}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4 mr-1" />
                삭제
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <Icon icon="solar:info-circle-linear" className="w-5 h-5 text-white/40" />
              <span className="text-white/60">아직 패널이 설치되지 않았습니다</span>
            </div>
          </div>
        )}

        {/* 패널 설치 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              설치할 채널 선택
            </label>
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="채널을 선택하세요">
                  {selectedChannelId && channels.find((c) => c.id === selectedChannelId)
                    ? `# ${channels.find((c) => c.id === selectedChannelId)?.name}`
                    : selectedChannelId
                      ? "로딩 중..."
                      : "채널을 선택하세요"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs text-slate-400"># 텍스트 채널</SelectLabel>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      # {channel.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-white/40 mt-2">
              패널이 전송될 텍스트 채널을 선택하세요. 기존 패널이 있다면 교체됩니다.
            </p>
          </div>

          <Button
            onClick={handleInstallPanel}
            disabled={!selectedChannelId || createPanel.isPending}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
          >
            {createPanel.isPending ? (
              <>
                <Icon icon="svg-spinners:ring-resize" className="w-4 h-4 mr-2" />
                설치 중...
              </>
            ) : (
              <>
                <Icon icon="solar:widget-add-bold" className="w-4 h-4 mr-2" />
                {panelSettings?.channelId ? "패널 교체" : "패널 설치"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 국고 관리자 역할 설정 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Icon icon="solar:shield-user-bold" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">국고 관리자 설정</h2>
            <p className="text-sm text-white/50">
              국고 명령어(/국고)를 사용할 수 있는 역할을 지정합니다
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              관리자 역할
            </label>
            <Select
              value={settings?.treasuryManagerRoleId ?? "none"}
              onValueChange={async (value) => {
                const roleId = value === "none" ? null : value;
                try {
                  await updateSettings.mutateAsync({ treasuryManagerRoleId: roleId });
                  toast({
                    title: "설정이 저장되었습니다",
                    description: roleId
                      ? `${roles.find((r) => r.id === roleId)?.name} 역할이 국고 관리자로 설정되었습니다.`
                      : "관리자만 국고 명령어를 사용할 수 있습니다.",
                  });
                } catch (error) {
                  toast({
                    title: "설정 저장 실패",
                    description: "다시 시도해주세요.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="역할을 선택하세요">
                  {settings?.treasuryManagerRoleId
                    ? `@${roles.find((r) => r.id === settings.treasuryManagerRoleId)?.name ?? "로딩 중..."}`
                    : "관리자만 사용 가능"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-white/60">관리자만 사용 가능</span>
                </SelectItem>
                <SelectGroup>
                  <SelectLabel className="text-xs text-slate-400">역할 목록</SelectLabel>
                  {roles
                    .filter((role) => role.name !== "@everyone")
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <span style={{ color: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : undefined }}>
                          @{role.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-white/40 mt-2">
              선택한 역할을 가진 멤버는 /국고 명령어로 국고를 관리할 수 있습니다.
              역할을 선택하지 않으면 서버 관리자만 사용할 수 있습니다.
            </p>
          </div>

          {/* 현재 설정 표시 */}
          {settings?.treasuryManagerRoleId && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Icon icon="solar:info-circle-bold" className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-white font-medium">현재 설정</span>
                  <p className="text-sm text-white/60">
                    @{roles.find((r) => r.id === settings.treasuryManagerRoleId)?.name ?? settings.treasuryManagerRoleId} 역할이 국고를 관리할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 패널 기능 안내 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Icon icon="solar:list-bold" className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-white">패널 기능</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:user-id-bold" className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">내 정보</h4>
              <p className="text-sm text-white/50">구독 상태, 금고 잔액, 혜택 확인</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:safe-circle-bold" className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">예금/출금</h4>
              <p className="text-sm text-white/50">금고에 안전하게 화폐 보관</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:history-bold" className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">거래 내역</h4>
              <p className="text-sm text-white/50">개인 거래 기록 확인</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:chart-bold" className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">국고 현황</h4>
              <p className="text-sm text-white/50">서버 국고 잔액 실시간 표시</p>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>패널을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              채널에 있는 {bankName} 패널 메시지가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePanel}
              className="bg-red-500 hover:bg-red-600"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
