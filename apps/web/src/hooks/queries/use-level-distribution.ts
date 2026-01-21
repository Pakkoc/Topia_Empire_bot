"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface LevelDistributionItem {
  range: string;
  count: number;
}

export interface LevelDistributionData {
  textDistribution: LevelDistributionItem[];
  voiceDistribution: LevelDistributionItem[];
  totalMembers: number;
}

export function useLevelDistribution(guildId: string) {
  return useQuery<LevelDistributionData>({
    queryKey: ["level-distribution", guildId],
    queryFn: async () => {
      const res = await apiClient.get<LevelDistributionData>(
        `/api/guilds/${guildId}/xp/level-distribution`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
