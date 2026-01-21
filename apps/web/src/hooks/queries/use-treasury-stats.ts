"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface DailyTrendItem {
  date: string;
  label: string;
  income: number;
  expense: number;
}

export interface TreasuryTypeStats {
  type: string;
  label: string;
  amount: number;
}

export interface TreasuryStatsData {
  dailyTrend: DailyTrendItem[];
  byType: TreasuryTypeStats[];
  totalIncome: number;
  totalExpense: number;
  period: string;
}

export function useTreasuryStats(guildId: string) {
  return useQuery<TreasuryStatsData>({
    queryKey: ["treasury-stats", guildId],
    queryFn: async () => {
      const res = await apiClient.get<TreasuryStatsData>(
        `/api/guilds/${guildId}/treasury/stats`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
