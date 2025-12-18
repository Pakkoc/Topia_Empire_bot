import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateLevelReward, LevelReward } from "@/types/xp";

export function useLevelRewards(guildId: string) {
  return useQuery({
    queryKey: ["level-rewards", guildId],
    queryFn: async () => {
      const response = await apiClient.get<LevelReward[]>(
        `/api/guilds/${guildId}/xp/rewards`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateLevelReward(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLevelReward) => {
      const response = await apiClient.post<LevelReward>(
        `/api/guilds/${guildId}/xp/rewards`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId] });
    },
  });
}

export function useUpdateLevelReward(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateLevelReward> }) => {
      const response = await apiClient.patch<LevelReward>(
        `/api/guilds/${guildId}/xp/rewards?id=${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId] });
    },
  });
}

export function useDeleteLevelReward(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/rewards?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId] });
    },
  });
}

// 다중 추가
export interface CreateLevelRewardBulk {
  level: number;
  roleIds: string[];
  removeOnHigherLevel: boolean;
}

export function useCreateLevelRewardBulk(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLevelRewardBulk) => {
      const response = await apiClient.post<{ created: number; skipped: number }>(
        `/api/guilds/${guildId}/xp/rewards/bulk`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId] });
    },
  });
}
