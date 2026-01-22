"use client";

import { useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { MemberTrendItem } from "@/hooks/queries/use-member-trend";

interface MemberTrendChartProps {
  monthlyData: MemberTrendItem[];
  yearlyData: MemberTrendItem[];
  isMonthlyLoading?: boolean;
  isYearlyLoading?: boolean;
}

export function MemberTrendChart({
  monthlyData,
  yearlyData,
  isMonthlyLoading,
  isYearlyLoading,
}: MemberTrendChartProps) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  const data = period === "monthly" ? monthlyData : yearlyData;
  const isLoading = period === "monthly" ? isMonthlyLoading : isYearlyLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="w-14 h-8 bg-white/10 rounded-lg animate-pulse" />
          <div className="w-14 h-8 bg-white/10 rounded-lg animate-pulse" />
        </div>
        <div className="h-[200px] bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  const hasData = data.length > 0;
  const maxTotal = Math.max(...data.map((d) => d.totalMembers), 1);
  const minTotal = Math.min(...data.map((d) => d.totalMembers), 0);
  const maxNew = Math.max(...data.map((d) => d.newMembers), 1);

  // Y축 도메인 계산 (여유 있게)
  const totalPadding = (maxTotal - minTotal) * 0.1;
  const totalDomain: [number, number] = [
    Math.max(0, Math.floor(minTotal - totalPadding)),
    Math.ceil(maxTotal + totalPadding),
  ];
  const newDomain: [number, number] = [0, Math.ceil(maxNew * 1.2)];

  // X축 라벨 간격 조정 (연간은 더 띄우기)
  const tickInterval = period === "yearly" ? 13 : 4;

  return (
    <div className="space-y-4">
      {/* 기간 선택 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod("monthly")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            period === "monthly"
              ? "bg-blue-500 text-white"
              : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
        >
          월간
        </button>
        <button
          onClick={() => setPeriod("yearly")}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            period === "yearly"
              ? "bg-blue-500 text-white"
              : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
        >
          연간
        </button>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-400 rounded-full" />
          <span className="text-white/60">총 회원수</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-400 rounded-full" />
          <span className="text-emerald-400/80">신규 가입</span>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-[200px] text-white/40">
          <p className="text-sm">데이터가 없습니다</p>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 40, left: 40, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.2)"
                horizontal={true}
                vertical={true}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                interval={tickInterval}
              />
              {/* 왼쪽 Y축: 총 회원수 */}
              <YAxis
                yAxisId="total"
                orientation="left"
                domain={totalDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(96, 165, 250, 0.7)", fontSize: 10 }}
                tickFormatter={(value) => value.toLocaleString()}
                width={35}
              />
              {/* 오른쪽 Y축: 신규 가입 */}
              <YAxis
                yAxisId="new"
                orientation="right"
                domain={newDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(52, 211, 153, 0.7)", fontSize: 10 }}
                width={30}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const total = payload.find(p => p.dataKey === "totalMembers")?.value as number;
                    const newMembers = payload.find(p => p.dataKey === "newMembers")?.value as number;
                    return (
                      <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                        <p className="text-white font-medium mb-1">{label}</p>
                        <p className="text-blue-400">
                          총 회원수: {total?.toLocaleString()}명
                        </p>
                        <p className="text-emerald-400">
                          신규 가입: {newMembers?.toLocaleString()}명
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* 총 회원수 라인 */}
              <Line
                yAxisId="total"
                type="monotone"
                dataKey="totalMembers"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                activeDot={{ fill: "#60a5fa", strokeWidth: 2, stroke: "#fff", r: 4 }}
              />
              {/* 신규 가입 라인 */}
              <Line
                yAxisId="new"
                type="monotone"
                dataKey="newMembers"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{ fill: "#34d399", strokeWidth: 2, stroke: "#fff", r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
