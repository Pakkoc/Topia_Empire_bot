"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface MemberActivityTrendItem {
  date: string;
  label: string;
  activeUsers: number;
}

export interface MemberActivityTrendData {
  dailyTrend: MemberActivityTrendItem[];
  totalActiveUsers: number;
  avgDailyActive: number;
  period: string;
}

export function useMemberActivityTrend(guildId: string) {
  return useQuery<MemberActivityTrendData>({
    queryKey: ["member-activity-trend", guildId],
    queryFn: async () => {
      const res = await apiClient.get<MemberActivityTrendData>(
        `/api/guilds/${guildId}/stats/member-activity-trend`
      );
      return res.data;
    },
    enabled: !!guildId,
  });
}
