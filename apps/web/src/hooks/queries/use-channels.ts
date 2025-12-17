import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface Channel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
}

export type ChannelFilter = "text" | "voice" | "category" | null;

export function useChannels(guildId: string, type: ChannelFilter = null) {
  return useQuery({
    queryKey: ["channels", guildId, type],
    queryFn: async () => {
      const params = type ? `?type=${type}` : "";
      const { data } = await axios.get<Channel[]>(
        `/api/guilds/${guildId}/channels${params}`
      );
      return data;
    },
    enabled: !!guildId,
  });
}

export function useTextChannels(guildId: string) {
  return useChannels(guildId, "text");
}

export function useVoiceChannels(guildId: string) {
  return useChannels(guildId, "voice");
}
