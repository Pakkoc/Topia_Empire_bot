import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CreateXpHotTime, XpHotTime } from "@/types/xp";

export function useXpHotTimes(guildId: string) {
  return useQuery({
    queryKey: ["xp-hot-times", guildId],
    queryFn: async () => {
      const response = await apiClient.get<XpHotTime[]>(
        `/api/guilds/${guildId}/xp/hot-times`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateXpHotTime(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateXpHotTime) => {
      const response = await apiClient.post<XpHotTime>(
        `/api/guilds/${guildId}/xp/hot-times`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-hot-times", guildId] });
    },
  });
}

export function useUpdateXpHotTime(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateXpHotTime> }) => {
      const response = await apiClient.patch<XpHotTime>(
        `/api/guilds/${guildId}/xp/hot-times?id=${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-hot-times", guildId] });
    },
  });
}

export function useDeleteXpHotTime(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/xp/hot-times?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["xp-hot-times", guildId] });
    },
  });
}
