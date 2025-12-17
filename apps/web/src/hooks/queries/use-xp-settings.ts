import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { UpdateXpSettings, XpSettings } from "@/types/xp";

export function useXpSettings(guildId: string) {
  return useQuery({
    queryKey: ["xp-settings", guildId],
    queryFn: async () => {
      const response = await apiClient.get<XpSettings>(
        `/api/guilds/${guildId}/xp/settings`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useUpdateXpSettings(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateXpSettings) => {
      const response = await apiClient.patch<XpSettings>(
        `/api/guilds/${guildId}/xp/settings`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["xp-settings", guildId], data);
    },
  });
}
