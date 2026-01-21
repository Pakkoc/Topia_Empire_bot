"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface WalletDistributionItem {
  range: string;
  count: number;
}

export interface WalletDistributionData {
  distribution: WalletDistributionItem[];
  totalWallets: number;
  totalBalance: number;
  top10Percent: number;
  giniCoefficient: number;
}

export function useWalletDistribution(guildId: string) {
  return useQuery<WalletDistributionData>({
    queryKey: ["wallet-distribution", guildId],
    queryFn: async () => {
      const res = await apiClient.get<WalletDistributionData>(
        `/api/guilds/${guildId}/currency/wallet-distribution`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
