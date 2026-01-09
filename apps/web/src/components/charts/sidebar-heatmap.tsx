"use client";

import { useMemo } from "react";
import type { HeatmapCell } from "@/hooks/queries/use-activity-heatmap";

interface SidebarHeatmapProps {
  cells: HeatmapCell[];
  maxCount: number;
  isLoading?: boolean;
}

// 요일 순서: 월, 화, 수, 목, 금, 토, 일
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
// API에서 오는 day 값 (0=일, 1=월, ..., 6=토)을 변환
const DAY_INDEX_MAP = [1, 2, 3, 4, 5, 6, 0]; // 월(1), 화(2), ..., 일(0)

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 퍼센트에 따른 배경색 (디코올 스타일)
function getCellColor(percent: number): string {
  if (percent === 0) return "bg-slate-800/50";
  if (percent < 20) return "bg-emerald-900/60";
  if (percent < 40) return "bg-emerald-800/70";
  if (percent < 60) return "bg-emerald-700/80";
  if (percent < 80) return "bg-emerald-600/90";
  return "bg-emerald-500";
}

export function SidebarHeatmap({
  cells,
  maxCount,
  isLoading,
}: SidebarHeatmapProps) {
  // 셀 데이터를 day×hour 맵으로 변환
  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of cells) {
      map.set(`${cell.day}-${cell.hour}`, cell.count);
    }
    return map;
  }, [cells]);

  // 퍼센트 계산 (최대값 대비)
  const getPercent = (apiDayIndex: number, hour: number): number => {
    const count = cellMap.get(`${apiDayIndex}-${hour}`) || 0;
    if (maxCount === 0) return 0;
    return Math.round((count / maxCount) * 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-700" />
        <div className="h-32 animate-pulse rounded bg-slate-700/50" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-white/60">활동 시간대</p>
      <div className="overflow-hidden rounded-lg bg-slate-900/50 p-2">
        <div className="flex gap-[2px]">
          {/* 시간 라벨 */}
          <div className="flex flex-col gap-[2px] pr-1">
            <div className="h-[16px]" /> {/* 요일 헤더 공간 */}
            {HOURS.map((hour) => (
              <div key={hour} className="h-[15px] text-[9px] text-white/30 leading-[15px] text-right">
                {hour % 4 === 0 ? hour.toString().padStart(2, "0") : ""}
              </div>
            ))}
          </div>
          {/* 히트맵 그리드 */}
          {DAY_INDEX_MAP.map((apiDayIndex, displayIndex) => (
            <div key={displayIndex} className="flex flex-col gap-[2px]">
              <div className="h-[16px] text-[10px] text-white/40 text-center leading-[16px]">
                {DAYS[displayIndex]}
              </div>
              {HOURS.map((hour) => {
                const percent = getPercent(apiDayIndex, hour);
                const bgClass = getCellColor(percent);
                return (
                  <div
                    key={hour}
                    className={`w-[30px] h-[15px] ${bgClass} rounded-sm`}
                    title={`${DAYS[displayIndex]} ${hour}시: ${percent}%`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
