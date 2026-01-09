import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface HeatmapCell {
  day: number; // 0-6 (일-토)
  hour: number; // 0-23
  count: number;
}

export interface ActivityHeatmapData {
  cells: HeatmapCell[];
  maxCount: number;
  totalActivities: number;
}

export function useActivityHeatmap(guildId: string) {
  return useQuery({
    queryKey: ["activity-heatmap", guildId],
    queryFn: async () => {
      const { data } = await axios.get<ActivityHeatmapData>(
        `/api/guilds/${guildId}/stats/activity-heatmap`
      );
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 60000, // 1분마다 갱신
  });
}
