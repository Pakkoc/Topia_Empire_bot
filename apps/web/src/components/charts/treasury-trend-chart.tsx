"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { DailyTrendItem } from "@/hooks/queries/use-treasury-stats";

interface TreasuryTrendChartProps {
  data: DailyTrendItem[];
  totalIncome: number;
  totalExpense: number;
  isLoading?: boolean;
  currencyName?: string;
}

export function TreasuryTrendChart({
  data,
  totalIncome,
  totalExpense,
  isLoading,
  currencyName = "토피",
}: TreasuryTrendChartProps) {
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.income, d.expense)),
    1
  );

  if (isLoading) {
    return (
      <div className="flex items-end justify-between gap-2 h-[140px] px-2">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-white/5 rounded-t animate-pulse"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    );
  }

  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[140px] text-white/40">
        <p className="text-sm">국고 거래 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
            />
            <YAxis hide domain={[0, maxValue * 1.1]} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const income = payload[0]?.value as number;
                  const expense = payload[1]?.value as number;
                  return (
                    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                      <p className="text-white font-medium mb-1">{label}</p>
                      <p className="text-emerald-400">
                        수입: {income?.toLocaleString()} {currencyName}
                      </p>
                      <p className="text-rose-400">
                        지출: {expense?.toLocaleString()} {currencyName}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {data.map((_, index) => (
                <Cell key={`income-${index}`} fill="#10b981" fillOpacity={0.8} />
              ))}
            </Bar>
            <Bar dataKey="expense" radius={[4, 4, 0, 0]} maxBarSize={20}>
              {data.map((_, index) => (
                <Cell key={`expense-${index}`} fill="#f43f5e" fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-white/60">수입</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-white/60">지출</span>
          </div>
        </div>
        <div className="text-white/40">
          순수익: <span className={totalIncome - totalExpense >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {(totalIncome - totalExpense).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
