import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export interface Treasury {
  guildId: string;
  topyBalance: string;
  rubyBalance: string;
  totalTopyCollected: string;
  totalRubyCollected: string;
  totalTopyDistributed: string;
  totalRubyDistributed: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TreasuryData {
  treasury: Treasury;
  monthlyCollected: {
    topy: string;
    ruby: string;
  };
  totalSupply: {
    topy: string;
    ruby: string;
  };
}

export interface TreasuryTransaction {
  id: string;
  guildId: string;
  currencyType: 'topy' | 'ruby';
  transactionType: 'transfer_fee' | 'shop_fee' | 'tax' | 'admin_distribute';
  amount: string;
  balanceAfter: string;
  relatedUserId: string | null;
  description: string | null;
  createdAt: string;
}

export interface TreasuryTransactionsData {
  transactions: TreasuryTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export function useTreasury(guildId: string) {
  return useQuery({
    queryKey: ["treasury", guildId],
    queryFn: async () => {
      const response = await apiClient.get<TreasuryData>(
        `/api/guilds/${guildId}/treasury`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}

export function useTreasuryTransactions(
  guildId: string,
  options?: {
    type?: 'transfer_fee' | 'shop_fee' | 'tax' | 'admin_distribute';
    limit?: number;
    offset?: number;
  }
) {
  const params = new URLSearchParams();
  if (options?.type) params.set("type", options.type);
  if (options?.limit) params.set("limit", options.limit.toString());
  if (options?.offset) params.set("offset", options.offset.toString());

  const queryString = params.toString();
  const url = `/api/guilds/${guildId}/treasury/transactions${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["treasury-transactions", guildId, options],
    queryFn: async () => {
      const response = await apiClient.get<TreasuryTransactionsData>(url);
      return response.data;
    },
    enabled: !!guildId,
  });
}
