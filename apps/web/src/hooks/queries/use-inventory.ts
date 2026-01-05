import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface InventoryItem {
  id: string;
  shopItemId: number;
  itemName: string;
  itemType: string | null;
  description: string | null;
  quantity: number;
  expiresAt: string | null;
  durationDays: number;
  topyPrice: string | null;
  rubyPrice: string | null;
  currencyType: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInventory {
  userId: string;
  items: InventoryItem[];
  totalItems: number;
}

export interface InventoriesResponse {
  inventories: Array<{
    userId: string;
    items: Array<{
      id: string;
      shopItemId: number;
      itemName: string;
      itemType: string | null;
      quantity: number;
      expiresAt: string | null;
      durationDays: number;
    }>;
    totalItems: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InventoryActionInput {
  userId: string;
  shopItemId: number;
  quantity: number;
  action: "give" | "take";
}

export interface InventoryActionResponse {
  success: boolean;
  message: string;
  userItem?: {
    id: string;
    quantity: number;
    expiresAt: string | null;
  };
  remainingQuantity?: number;
}

// 전체 인벤토리 목록 조회
export function useInventories(
  guildId: string,
  page: number = 1,
  limit: number = 20,
  search?: string
) {
  return useQuery({
    queryKey: ["inventories", guildId, page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.set("search", search);
      }
      const response = await apiClient.get<InventoriesResponse>(
        `/api/guilds/${guildId}/currency/inventory?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

// 특정 유저 인벤토리 조회
export function useUserInventory(guildId: string, userId: string) {
  return useQuery({
    queryKey: ["user-inventory", guildId, userId],
    queryFn: async () => {
      const response = await apiClient.get<UserInventory>(
        `/api/guilds/${guildId}/currency/inventory/${userId}`
      );
      return response.data;
    },
    enabled: !!guildId && !!userId,
  });
}

// 아이템 지급/회수
export function useInventoryAction(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InventoryActionInput) => {
      const response = await apiClient.post<InventoryActionResponse>(
        `/api/guilds/${guildId}/currency/inventory`,
        input
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      // 해당 유저 인벤토리 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ["user-inventory", guildId, variables.userId],
      });
      // 전체 인벤토리 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ["inventories", guildId],
      });
    },
  });
}
