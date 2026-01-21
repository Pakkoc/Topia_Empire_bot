"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface TransactionDistribution {
  type: string;
  label: string;
  count: number;
  totalAmount: number;
}

export interface CurrencyStatsData {
  distribution: TransactionDistribution[];
  totalTransactions: number;
  period: string;
}

export function useCurrencyStats(guildId: string) {
  return useQuery<CurrencyStatsData>({
    queryKey: ["currency-stats", guildId],
    queryFn: async () => {
      const res = await apiClient.get<CurrencyStatsData>(
        `/api/guilds/${guildId}/currency/stats`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
