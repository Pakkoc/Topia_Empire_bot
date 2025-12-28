import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface GameSettings {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  managerRoleId: string | null;
  betFeePercent: number;
  minBet: string;
  maxBet: string;
}

// Fetch game settings
export function useGameSettings(guildId: string) {
  return useQuery<GameSettings | null>({
    queryKey: ["game-settings", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/game/settings`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch game settings");
      }
      return res.json();
    },
  });
}

// Create game panel
export function useCreateGamePanel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; messageId: string }, Error, string>({
    mutationFn: async (channelId: string) => {
      const res = await fetch(`/api/guilds/${guildId}/game/panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create game panel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-settings", guildId] });
    },
  });
}

// Update game settings
export function useUpdateGameSettings(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<GameSettings, Error, Partial<GameSettings>>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/game/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update game settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-settings", guildId] });
    },
  });
}
