import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateLevelUnlockChannel, LevelUnlockChannel, XpType } from "@/types/xp";

export function useLevelChannels(guildId: string, type: XpType = 'text') {
  return useQuery({
    queryKey: ["level-channels", guildId, type],
    queryFn: async () => {
      const response = await apiClient.get<LevelUnlockChannel[]>(
        `/api/guilds/${guildId}/xp/level-channels?type=${type}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateLevelChannel(guildId: string, type: XpType = 'text') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLevelUnlockChannel) => {
      const response = await apiClient.post<LevelUnlockChannel>(
        `/api/guilds/${guildId}/xp/level-channels?type=${type}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-channels", guildId, type] });
    },
  });
}

export function useUpdateLevelChannel(guildId: string, type: XpType = 'text') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateLevelUnlockChannel> }) => {
      const response = await apiClient.patch<LevelUnlockChannel>(
        `/api/guilds/${guildId}/xp/level-channels?id=${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-channels", guildId, type] });
    },
  });
}

export function useDeleteLevelChannel(guildId: string, type: XpType = 'text') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/level-channels?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-channels", guildId, type] });
    },
  });
}
