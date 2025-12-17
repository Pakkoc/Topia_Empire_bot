import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { DiscordGuildWithBot } from "@/types/discord";

export function useGuilds() {
  return useQuery({
    queryKey: ["guilds"],
    queryFn: async () => {
      const response = await apiClient.get<DiscordGuildWithBot[]>("/api/guilds");
      return response.data;
    },
  });
}
