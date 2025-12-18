import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateXpExclusion, XpExclusion } from "@/types/xp";

export function useXpExclusions(guildId: string) {
  return useQuery({
    queryKey: ["xp-exclusions", guildId],
    queryFn: async () => {
      const response = await apiClient.get<XpExclusion[]>(
        `/api/guilds/${guildId}/xp/exclusions`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateXpExclusion(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateXpExclusion) => {
      const response = await apiClient.post<XpExclusion>(
        `/api/guilds/${guildId}/xp/exclusions`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-exclusions", guildId] });
    },
  });
}

export function useDeleteXpExclusion(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/exclusions?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-exclusions", guildId] });
    },
  });
}

// 다중 추가
export interface CreateXpExclusionBulk {
  targetType: "channel" | "role";
  targetIds: string[];
}

export function useCreateXpExclusionBulk(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateXpExclusionBulk) => {
      const response = await apiClient.post<{ created: number; skipped: number }>(
        `/api/guilds/${guildId}/xp/exclusions/bulk`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-exclusions", guildId] });
    },
  });
}
