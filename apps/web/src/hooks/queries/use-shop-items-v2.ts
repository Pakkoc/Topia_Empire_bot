import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ShopItemV2,
  CreateShopItemV2,
  UpdateShopItemV2,
} from "@/types/shop-v2";

// Fetch shop items V2
export function useShopItemsV2(guildId: string) {
  return useQuery<ShopItemV2[]>({
    queryKey: ["shop-items-v2", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/shop-v2/items`);
      if (!res.ok) throw new Error("Failed to fetch shop items");
      return res.json();
    },
  });
}

// Fetch single shop item V2
export function useShopItemV2(guildId: string, itemId: number | null) {
  return useQuery<ShopItemV2>({
    queryKey: ["shop-items-v2", guildId, itemId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/shop-v2/items/${itemId}`);
      if (!res.ok) throw new Error("Failed to fetch shop item");
      return res.json();
    },
    enabled: !!itemId,
  });
}

// Create shop item V2
export function useCreateShopItemV2(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<ShopItemV2, Error, CreateShopItemV2>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/shop-v2/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create shop item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items-v2", guildId] });
    },
  });
}

// Update shop item V2
export function useUpdateShopItemV2(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<ShopItemV2, Error, { id: number; data: UpdateShopItemV2 }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/guilds/${guildId}/shop-v2/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update shop item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items-v2", guildId] });
    },
  });
}

// Delete shop item V2
export function useDeleteShopItemV2(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/guilds/${guildId}/shop-v2/items/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete shop item");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items-v2", guildId] });
    },
  });
}

// Create shop panel
export function useCreateShopPanel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; messageId: string }, Error, string>({
    mutationFn: async (channelId: string) => {
      const res = await fetch(`/api/guilds/${guildId}/shop/panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create shop panel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-settings", guildId] });
    },
  });
}

// Seed default shop items
interface SeedResult {
  success: boolean;
  message: string;
  seeded: number;
  items?: string[];
}

export function useSeedDefaultItems(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<SeedResult, Error, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/shop-v2/seed`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to seed default items");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items-v2", guildId] });
    },
  });
}
