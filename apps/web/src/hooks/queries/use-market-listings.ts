import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export type MarketCategory = "design" | "music" | "video" | "coding" | "other";
export type MarketStatus = "active" | "sold" | "cancelled" | "expired";

export interface MarketListing {
  id: string;
  guildId: string;
  sellerId: string;
  title: string;
  description: string | null;
  category: MarketCategory;
  price: string;
  currencyType: "topy" | "ruby";
  status: MarketStatus;
  buyerId: string | null;
  createdAt: string;
  expiresAt: string;
  soldAt: string | null;
}

export interface MarketListingsResponse {
  listings: MarketListing[];
  total: number;
  limit: number;
  offset: number;
}

export interface MarketListingsFilter {
  status?: MarketStatus;
  category?: MarketCategory;
  currencyType?: "topy" | "ruby";
  sellerId?: string;
}

export interface CreateListingData {
  sellerId: string;
  title: string;
  description?: string;
  category: MarketCategory;
  price: number;
  currencyType: "topy" | "ruby";
}

export const CATEGORY_LABELS: Record<MarketCategory, string> = {
  design: "디자인",
  music: "음악",
  video: "영상",
  coding: "코딩",
  other: "기타",
};

export const CATEGORY_ICONS: Record<MarketCategory, string> = {
  design: "solar:pallete-2-bold",
  music: "solar:music-note-bold",
  video: "solar:video-frame-bold",
  coding: "solar:code-bold",
  other: "solar:star-bold",
};

export const STATUS_LABELS: Record<MarketStatus, string> = {
  active: "판매중",
  sold: "판매완료",
  cancelled: "취소됨",
  expired: "만료됨",
};

export const STATUS_COLORS: Record<MarketStatus, string> = {
  active: "text-green-400 bg-green-500/20 border-green-500/30",
  sold: "text-blue-400 bg-blue-500/20 border-blue-500/30",
  cancelled: "text-gray-400 bg-gray-500/20 border-gray-500/30",
  expired: "text-orange-400 bg-orange-500/20 border-orange-500/30",
};

export function useMarketListings(
  guildId: string,
  page: number = 1,
  limit: number = 20,
  filter?: MarketListingsFilter
) {
  const offset = (page - 1) * limit;

  return useQuery({
    queryKey: ["market-listings", guildId, page, limit, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filter?.status) {
        params.set("status", filter.status);
      }
      if (filter?.category) {
        params.set("category", filter.category);
      }
      if (filter?.currencyType) {
        params.set("currencyType", filter.currencyType);
      }
      if (filter?.sellerId) {
        params.set("sellerId", filter.sellerId);
      }

      const response = await apiClient.get<MarketListingsResponse>(
        `/api/guilds/${guildId}/market/listings?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useMarketListing(guildId: string, listingId: string) {
  return useQuery({
    queryKey: ["market-listing", guildId, listingId],
    queryFn: async () => {
      const response = await apiClient.get<MarketListing>(
        `/api/guilds/${guildId}/market/listings/${listingId}`
      );
      return response.data;
    },
    enabled: !!guildId && !!listingId,
  });
}

export function useCreateMarketListing(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateListingData) => {
      const response = await apiClient.post<MarketListing>(
        `/api/guilds/${guildId}/market/listings`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-listings", guildId] });
    },
  });
}

export function useCancelMarketListing(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: string) => {
      await apiClient.delete(`/api/guilds/${guildId}/market/listings/${listingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-listings", guildId] });
    },
  });
}
