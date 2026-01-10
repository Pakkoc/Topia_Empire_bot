import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateLevelReward, LevelReward, XpType } from "@/types/xp";

export function useLevelRewards(guildId: string, type: XpType = 'text') {
  return useQuery({
    queryKey: ["level-rewards", guildId, type],
    queryFn: async () => {
      const response = await apiClient.get<LevelReward[]>(
        `/api/guilds/${guildId}/xp/rewards?type=${type}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateLevelReward(guildId: string, type: XpType = 'text') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLevelReward) => {
      const response = await apiClient.post<LevelReward>(
        `/api/guilds/${guildId}/xp/rewards?type=${type}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId, type] });
    },
  });
}

export function useUpdateLevelReward(guildId: string, type: XpType = 'text') {
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
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId, type] });
    },
  });
}

export function useDeleteLevelReward(guildId: string, type: XpType = 'text') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/rewards?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId, type] });
    },
  });
}

// 다중 추가
export interface CreateLevelRewardBulk {
  level: number;
  roleIds: string[];
  removeOnHigherLevel: boolean;
}

export function useCreateLevelRewardBulk(guildId: string, type: XpType = 'text') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLevelRewardBulk) => {
      const response = await apiClient.post<{ created: number; skipped: number }>(
        `/api/guilds/${guildId}/xp/rewards/bulk?type=${type}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["level-rewards", guildId, type] });
    },
  });
}
