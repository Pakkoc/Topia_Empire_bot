import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type RankRewards = Record<number, number>;

export interface GameSettings {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  managerRoleId: string | null;
  entryFee: string;
  rankRewards: RankRewards;
}

export interface GameCategory {
  id: number;
  guildId: string;
  name: string;
  teamCount: number;
  maxPlayersPerTeam: number | null;
  rankRewards: RankRewards | null;
  winnerTakesAll: boolean;
  enabled: boolean;
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

// Fetch game categories
export function useGameCategories(guildId: string) {
  return useQuery<GameCategory[]>({
    queryKey: ["game-categories", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/game/categories`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch game categories");
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

  return useMutation<GameSettings, Error, {
    managerRoleId?: string | null;
    entryFee?: string;
    rankRewards?: RankRewards;
  }>({
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

// Create game category
export function useCreateGameCategory(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<GameCategory, Error, {
    name: string;
    teamCount: number;
    maxPlayersPerTeam?: number | null;
    rankRewards?: RankRewards;
    winnerTakesAll?: boolean;
  }>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/game/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-categories", guildId] });
    },
  });
}

// Update game category
export function useUpdateGameCategory(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<GameCategory, Error, { id: number; name?: string; teamCount?: number; enabled?: boolean }>({
    mutationFn: async ({ id, ...data }) => {
      const res = await fetch(`/api/guilds/${guildId}/game/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-categories", guildId] });
    },
  });
}

// Delete game category
export function useDeleteGameCategory(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (categoryId) => {
      const res = await fetch(`/api/guilds/${guildId}/game/categories/${categoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete category");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-categories", guildId] });
    },
  });
}
