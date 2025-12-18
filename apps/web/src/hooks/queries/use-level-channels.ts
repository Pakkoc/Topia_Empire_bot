import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateLevelUnlockChannel, LevelUnlockChannel } from "@/types/xp";

export function useLevelChannels(guildId: string) {
  return useQuery({
    queryKey: ["level-channels", guildId],
    queryFn: async () => {
      const response = await apiClient.get<LevelUnlockChannel[]>(
        `/api/guilds/${guildId}/xp/level-channels`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateLevelChannel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLevelUnlockChannel) => {
      const response = await apiClient.post<LevelUnlockChannel>(
        `/api/guilds/${guildId}/xp/level-channels`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-channels", guildId] });
    },
  });
}

export function useUpdateLevelChannel(guildId: string) {
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
      queryClient.invalidateQueries({ queryKey: ["level-channels", guildId] });
    },
  });
}

export function useDeleteLevelChannel(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/level-channels?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-channels", guildId] });
    },
  });
}
