import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ShopPanelSettings {
  guildId: string;
  currencyType: 'topy' | 'ruby';
  channelId: string | null;
  messageId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Fetch all shop panel settings
export function useShopPanelSettings(guildId: string) {
  return useQuery<ShopPanelSettings[]>({
    queryKey: ["shop-panel-settings", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/shop-panel/settings`);
      if (!res.ok) {
        throw new Error("Failed to fetch shop panel settings");
      }
      return res.json();
    },
  });
}

// Get specific currency type settings
export function useShopPanelSettingsByCurrency(
  guildId: string,
  currencyType: 'topy' | 'ruby'
) {
  const { data, ...rest } = useShopPanelSettings(guildId);

  const settings = data?.find(s => s.currencyType === currencyType) ?? null;

  return { data: settings, ...rest };
}

// Create topy shop panel
export function useCreateTopyShopPanel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; messageId: string }, Error, string>({
    mutationFn: async (channelId: string) => {
      const res = await fetch(`/api/guilds/${guildId}/shop-panel/topy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create topy shop panel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-panel-settings", guildId] });
    },
  });
}

// Create ruby shop panel
export function useCreateRubyShopPanel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; messageId: string }, Error, string>({
    mutationFn: async (channelId: string) => {
      const res = await fetch(`/api/guilds/${guildId}/shop-panel/ruby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create ruby shop panel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-panel-settings", guildId] });
    },
  });
}
