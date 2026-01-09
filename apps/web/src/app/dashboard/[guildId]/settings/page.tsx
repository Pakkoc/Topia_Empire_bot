"use client";

import { useParams } from "next/navigation";
import { useDataRetentionSettings, useUpdateDataRetentionSettings, useActivityHeatmap } from "@/hooks/queries";
import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow, format } from "date-fns";
import { ko } from "date-fns/locale";

// 데이터 보존 기간 옵션 (일 단위)
const RETENTION_OPTIONS = [
  { value: "0", label: "즉시 삭제" },
  { value: "1", label: "1일" },
  { value: "3", label: "3일" },
  { value: "7", label: "7일" },
  { value: "14", label: "14일" },
  { value: "30", label: "30일" },
];

export default function GuildSettingsPage() {
  const params = useParams();
  const guildId = params['guildId'] as string;
  const { toast } = useToast();

  // 데이터 보존 설정
  const { data: dataRetentionSettings, isLoading } = useDataRetentionSettings(guildId);
  const updateDataRetention = useUpdateDataRetentionSettings(guildId);
  const [retentionDays, setRetentionDays] = useState<number>(3);

  // 활동 히트맵
  const { data: heatmapData, isLoading: isHeatmapLoading } = useActivityHeatmap(guildId);

  useEffect(() => {
    if (dataRetentionSettings) {
      setRetentionDays(dataRetentionSettings.retentionDays);
    }
  }, [dataRetentionSettings]);

  const handleRetentionDaysChange = async (value: string) => {
    const days = parseInt(value);
    setRetentionDays(days);
    try {
      await updateDataRetention.mutateAsync({ retentionDays: days });
      toast({
        title: "설정 저장 완료",
        description: `탈퇴 유저 데이터가 ${days === 0 ? '즉시 삭제' : `${days}일 후 삭제`}됩니다.`,
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
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-slate-400">봇 기본 설정을 관리합니다.</p>
      </div>

      {/* Bot Info */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Icon icon="solar:settings-linear" className="h-5 w-5" />
            봇 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">서버 ID</span>
            <code className="text-sm text-slate-300">{guildId}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">봇 상태</span>
            <Badge variant="outline" className="text-slate-400">
              연결 대기
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Activity Heatmap */}
      <ActivityHeatmap
        cells={heatmapData?.cells ?? []}
        maxCount={heatmapData?.maxCount ?? 0}
        totalActivities={heatmapData?.totalActivities ?? 0}
        isLoading={isHeatmapLoading}
      />

      {/* Data Retention Settings */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Icon icon="solar:clock-circle-linear" className="h-5 w-5 text-blue-500" />
            데이터 보존 설정
          </CardTitle>
          <CardDescription>
            서버를 탈퇴한 유저의 데이터 보존 기간을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-slate-700 p-4">
            <div className="space-y-1.5">
              <p className="text-base font-medium text-white">탈퇴 유저 데이터 보존 기간</p>
              <p className="text-sm text-slate-400">
                {retentionDays === 0
                  ? "탈퇴 즉시 데이터가 삭제됩니다."
                  : `탈퇴 후 ${retentionDays}일간 데이터가 보존됩니다. 기간 내 재입장 시 데이터가 복구됩니다.`}
              </p>
              <p className="text-xs text-indigo-400">
                프리미엄 구독 시 최대 100일까지 보존 가능
              </p>
            </div>
            <Select
              value={retentionDays.toString()}
              onValueChange={handleRetentionDaysChange}
              disabled={updateDataRetention.isPending}
            >
              <SelectTrigger className="w-32 bg-slate-700 text-white border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 탈퇴 대기 중인 유저 목록 */}
          {dataRetentionSettings?.leftMembers && dataRetentionSettings.leftMembers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">
                삭제 대기 중인 유저 데이터 ({dataRetentionSettings.leftMembers.length}명)
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700">
                {dataRetentionSettings.leftMembers.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 hover:bg-slate-700/50">
                    <div>
                      <code className="text-sm text-slate-300">{member.userId}</code>
                      <p className="text-xs text-slate-500">
                        탈퇴: {format(new Date(member.leftAt), "yyyy-MM-dd HH:mm", { locale: ko })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-orange-400 border-orange-400/50">
                      {formatDistanceToNow(new Date(member.expiresAt), { locale: ko, addSuffix: true })} 삭제
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <Icon icon="solar:danger-triangle-linear" className="h-5 w-5" />
            위험 구역
          </CardTitle>
          <CardDescription>주의가 필요한 작업</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-red-500/30 p-4">
            <div>
              <p className="font-medium text-white">XP 데이터 초기화</p>
              <p className="text-sm text-slate-400">
                이 서버의 모든 XP 데이터를 삭제합니다. 되돌릴 수 없습니다.
              </p>
            </div>
            <Button variant="destructive" disabled>
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
