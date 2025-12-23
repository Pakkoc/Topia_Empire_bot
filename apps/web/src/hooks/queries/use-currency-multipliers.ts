import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";
import { CurrencyMultiplier, CreateCurrencyMultiplier } from "@/types/currency";

export function useCurrencyMultipliers(guildId: string) {
  return useQuery({
    queryKey: ["currency-multipliers", guildId],
    queryFn: async () => {
      const response = await apiClient.get<CurrencyMultiplier[]>(
        `/api/guilds/${guildId}/currency/multipliers`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useCreateCurrencyMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCurrencyMultiplier) => {
      const response = await apiClient.post<CurrencyMultiplier>(
        `/api/guilds/${guildId}/currency/multipliers`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-multipliers", guildId] });
    },
  });
}

export function useUpdateCurrencyMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { multiplier: number } }) => {
      const response = await apiClient.patch(
        `/api/guilds/${guildId}/currency/multipliers?id=${id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-multipliers", guildId] });
    },
  });
}

export function useDeleteCurrencyMultiplier(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/guilds/${guildId}/currency/multipliers?id=${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currency-multipliers", guildId] });
    },
  });
}
