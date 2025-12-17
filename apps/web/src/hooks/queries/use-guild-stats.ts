import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface GuildStats {
  totalMembers: number;
  membersWithXp: number;
  totalXp: number;
  avgLevel: number;
  maxLevel: number;
  xpEnabled: boolean;
  textXpEnabled: boolean;
  voiceXpEnabled: boolean;
  todayTextActive: number;
  todayVoiceActive: number;
  topUsers: {
    userId: string;
    xp: number;
    level: number;
  }[];
}

export function useGuildStats(guildId: string) {
  return useQuery({
    queryKey: ["guild-stats", guildId],
    queryFn: async () => {
      const { data } = await axios.get<GuildStats>(
        `/api/guilds/${guildId}/stats`
      );
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
