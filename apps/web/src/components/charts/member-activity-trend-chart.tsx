"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { MemberActivityTrendItem } from "@/hooks/queries/use-member-activity-trend";

interface MemberActivityTrendChartProps {
  data: MemberActivityTrendItem[];
  totalMembers: number;
  isLoading?: boolean;
}

export function MemberActivityTrendChart({
  data,
  totalMembers,
  isLoading,
}: MemberActivityTrendChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[180px]">
        <div className="w-full h-full bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  const hasData = data.some((d) => d.activeUsers > 0);
  const maxActive = Math.max(...data.map((d) => d.activeUsers), 1);
  const yAxisMax = Math.max(maxActive * 1.2, totalMembers * 0.3);

  if (!hasData && totalMembers === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[180px] text-white/40">
        <p className="text-sm">데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis
              hide
              domain={[0, yAxisMax]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const activeUsers = payload[0]?.value as number;
                  const percent = totalMembers > 0
                    ? Math.round((activeUsers / totalMembers) * 100)
                    : 0;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium mb-1">{label}</p>
                      <p className="text-emerald-400">
                        활동 유저: {activeUsers?.toLocaleString()}명
                      </p>
                      {totalMembers > 0 && (
                        <p className="text-white/50 text-xs mt-1">
                          전체의 {percent}%
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* 총 멤버 수 참조선 */}
            {totalMembers > 0 && totalMembers <= yAxisMax && (
              <ReferenceLine
                y={totalMembers}
                stroke="rgba(59, 130, 246, 0.5)"
                strokeDasharray="5 5"
                label={{
                  value: `총 ${totalMembers.toLocaleString()}명`,
                  position: "right",
                  fill: "rgba(59, 130, 246, 0.7)",
                  fontSize: 10,
                }}
              />
            )}
            {/* 활동 유저 영역 */}
            <Area
              type="monotone"
              dataKey="activeUsers"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#activeGradient)"
            />
            {/* 활동 유저 라인 */}
            <Line
              type="monotone"
              dataKey="activeUsers"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
              activeDot={{ fill: "#10b981", strokeWidth: 2, stroke: "#fff", r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-500 rounded-full" />
          <span className="text-white/60">일별 활동 유저</span>
        </div>
        {totalMembers > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-blue-500/50 rounded-full border-dashed" style={{ borderTop: "2px dashed rgba(59, 130, 246, 0.5)" }} />
            <span className="text-white/60">총 멤버 수</span>
          </div>
        )}
      </div>
    </div>
  );
}
