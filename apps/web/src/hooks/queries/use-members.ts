import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface Member {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  joinedAt: string;
  xp: number;
  level: number;
  lastTextXpAt: string | null;
  lastVoiceXpAt: string | null;
  hasXpData: boolean;
}

export interface MembersResponse {
  members: Member[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UseMembersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "xp" | "level" | "joinedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export function useMembers(guildId: string, params: UseMembersParams = {}) {
  const { page = 1, limit = 20, search = "", sortBy = "xp", sortOrder = "desc" } = params;

  return useQuery({
    queryKey: ["members", guildId, { page, limit, search, sortBy, sortOrder }],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      if (search) {
        searchParams.set("search", search);
      }

      const { data } = await axios.get<MembersResponse>(
        `/api/guilds/${guildId}/members?${searchParams.toString()}`
      );
      return data;
    },
    enabled: !!guildId,
  });
}
