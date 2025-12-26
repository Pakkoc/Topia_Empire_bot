import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface CurrencyManager {
  id: number;
  guildId: string;
  userId: string;
  createdAt: string;
}

export function useCurrencyManagers(guildId: string) {
  return useQuery({
    queryKey: ["currency-managers", guildId],
    queryFn: () =>
      apiClient.get<CurrencyManager[]>(`/guilds/${guildId}/currency/managers`),
    enabled: !!guildId,
  });
}

export function useAddCurrencyManager(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.post<CurrencyManager>(`/guilds/${guildId}/currency/managers`, {
        userId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currency-managers", guildId],
      });
    },
  });
}

export function useRemoveCurrencyManager(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/guilds/${guildId}/currency/managers`, {
        data: { userId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currency-managers", guildId],
      });
    },
  });
}
