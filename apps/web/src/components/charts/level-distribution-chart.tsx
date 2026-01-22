"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { LevelDistributionItem } from "@/hooks/queries/use-level-distribution";

interface LevelDistributionChartProps {
  textData: LevelDistributionItem[];
  voiceData: LevelDistributionItem[];
  isLoading?: boolean;
}

const LEVEL_COLORS = [
  "#64748b", // slate-500 (0)
  "#22c55e", // green-500 (1-5)
  "#3b82f6", // blue-500 (6-10)
  "#8b5cf6", // violet-500 (11-20)
  "#f59e0b", // amber-500 (21-30)
  "#f97316", // orange-500 (31-50)
  "#ef4444", // red-500 (51+)
];

export function LevelDistributionChart({
  textData,
  voiceData,
  isLoading,
}: LevelDistributionChartProps) {
  // 텍스트와 음성 데이터 합산
  const chartData = textData.map((item, index) => ({
    range: item.range === '0' ? 'Lv.0' : `Lv.${item.range}`,
    text: item.count,
    voice: voiceData[index]?.count ?? 0,
    color: LEVEL_COLORS[index % LEVEL_COLORS.length],
  }));

  const maxCount = Math.max(
    ...chartData.map((d) => Math.max(d.text, d.voice)),
    1
  );

  const skeletonHeights = [60, 80, 45, 70, 55, 85, 65];

  if (isLoading) {
    return (
      <div className="flex items-end justify-between gap-2 h-[140px] px-2">
        {skeletonHeights.map((height, i) => (
          <div
            key={i}
            className="flex-1 bg-white/5 rounded-t animate-pulse"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    );
  }

  const totalText = textData.reduce((sum, d) => sum + d.count, 0);
  const totalVoice = voiceData.reduce((sum, d) => sum + d.count, 0);

  if (totalText === 0 && totalVoice === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[140px] text-white/40">
        <p className="text-sm">레벨 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={0}>
            <XAxis
              dataKey="range"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              interval={0}
            />
            <YAxis hide domain={[0, maxCount * 1.1]} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium mb-1">{label}</p>
                      <p className="text-green-400">텍스트: {payload[0]?.value?.toLocaleString()}명</p>
                      <p className="text-purple-400">음성: {payload[1]?.value?.toLocaleString()}명</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="text" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`text-${index}`} fill="#22c55e" fillOpacity={0.8} />
              ))}
            </Bar>
            <Bar dataKey="voice" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`voice-${index}`} fill="#a855f7" fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-white/60">텍스트</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          <span className="text-white/60">음성</span>
        </div>
      </div>
    </div>
  );
}
