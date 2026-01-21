"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TransactionDistribution } from "@/hooks/queries/use-currency-stats";

interface TransactionDistributionChartProps {
  data: TransactionDistribution[];
  isLoading?: boolean;
}

const COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
];

export function TransactionDistributionChart({
  data,
  isLoading,
}: TransactionDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 상위 6개 + 나머지
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const top6 = sorted.slice(0, 6);
    const others = sorted.slice(6);

    const result = top6.map((item, index) => ({
      ...item,
      color: COLORS[index % COLORS.length],
    }));

    if (others.length > 0) {
      const otherCount = others.reduce((sum, item) => sum + item.count, 0);
      result.push({
        type: "others",
        label: "기타",
        count: otherCount,
        totalAmount: others.reduce((sum, item) => sum + item.totalAmount, 0),
        color: COLORS[6],
      });
    }

    return result;
  }, [data]);

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <div className="w-32 h-32 rounded-full bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] text-white/40">
        <p className="text-sm">거래 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-[140px] h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={2}
              dataKey="count"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  const percent = total > 0 ? ((data.count / total) * 100).toFixed(1) : 0;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium">{data.label}</p>
                      <p className="text-white/60">{data.count.toLocaleString()}건 ({percent}%)</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5">
        {chartData.slice(0, 5).map((item) => {
          const percent = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
          return (
            <div key={item.type} className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-white/70 truncate flex-1">{item.label}</span>
              <span className="text-white/50">{percent}%</span>
            </div>
          );
        })}
        {chartData.length > 5 && (
          <div className="text-xs text-white/40 pl-4">+{chartData.length - 5}개 더</div>
        )}
      </div>
    </div>
  );
}
