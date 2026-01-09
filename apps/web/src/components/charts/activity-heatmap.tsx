"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@iconify/react";
import type { HeatmapCell } from "@/hooks/queries/use-activity-heatmap";

interface ActivityHeatmapProps {
  cells: HeatmapCell[];
  maxCount: number;
  totalActivities: number;
  isLoading?: boolean;
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 활동량에 따른 색상 강도 계산
function getColorIntensity(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) {
    return "bg-slate-800";
  }
  const intensity = count / maxCount;
  if (intensity < 0.2) return "bg-emerald-900/50";
  if (intensity < 0.4) return "bg-emerald-700/60";
  if (intensity < 0.6) return "bg-emerald-600/70";
  if (intensity < 0.8) return "bg-emerald-500/80";
  return "bg-emerald-400";
}

export function ActivityHeatmap({
  cells,
  maxCount,
  totalActivities,
  isLoading,
}: ActivityHeatmapProps) {
  // 셀 데이터를 day×hour 맵으로 변환
  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of cells) {
      map.set(`${cell.day}-${cell.hour}`, cell.count);
    }
    return map;
  }, [cells]);

  if (isLoading) {
    return (
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <div className="h-6 w-48 animate-pulse rounded bg-slate-700" />
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse rounded bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Icon icon="solar:chart-square-linear" className="h-5 w-5 text-emerald-500" />
          서버 활동 시간대
        </CardTitle>
        <CardDescription>
          최근 30일간 서버 멤버들의 활동 시간대입니다.
          {totalActivities > 0 && (
            <span className="ml-2 text-slate-300">
              총 {totalActivities.toLocaleString()}회 활동
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* 시간 레이블 */}
            <div className="flex items-center gap-1 mb-1">
              <div className="w-8" /> {/* 요일 레이블 공간 */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center text-xs text-slate-500"
                >
                  {hour % 3 === 0 ? hour : ""}
                </div>
              ))}
            </div>

            {/* 히트맵 그리드 */}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-8 text-xs text-slate-400 text-right pr-2">
                  {day}
                </div>
                {HOURS.map((hour) => {
                  const count = cellMap.get(`${dayIndex}-${hour}`) || 0;
                  const colorClass = getColorIntensity(count, maxCount);
                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={`flex-1 aspect-square rounded-sm ${colorClass} transition-colors hover:ring-1 hover:ring-white/30`}
                      title={`${day}요일 ${hour}시: ${count}회 활동`}
                    />
                  );
                })}
              </div>
            ))}

            {/* 범례 */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-400">
              <span>적음</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-slate-800" />
                <div className="w-3 h-3 rounded-sm bg-emerald-900/50" />
                <div className="w-3 h-3 rounded-sm bg-emerald-700/60" />
                <div className="w-3 h-3 rounded-sm bg-emerald-600/70" />
                <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
                <div className="w-3 h-3 rounded-sm bg-emerald-400" />
              </div>
              <span>많음</span>
            </div>
          </div>
        </div>

        {totalActivities === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Icon icon="solar:chart-square-linear" className="h-12 w-12 mb-2 opacity-50" />
            <p>아직 활동 데이터가 없습니다</p>
            <p className="text-sm text-slate-500">서버에서 활동이 기록되면 여기에 표시됩니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
