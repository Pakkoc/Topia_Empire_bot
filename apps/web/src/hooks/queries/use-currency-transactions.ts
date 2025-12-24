import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/remote/api-client";

export type CurrencyType = "topy" | "ruby";

export type TransactionType =
  | "earn_text"
  | "earn_voice"
  | "earn_attendance"
  | "transfer_in"
  | "transfer_out"
  | "shop_purchase"
  | "tax"
  | "fee"
  | "admin_add"
  | "admin_remove";

export interface CurrencyTransaction {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  currencyType: CurrencyType;
  transactionType: TransactionType;
  amount: string;
  balanceAfter: string;
  fee: string;
  relatedUserId: string | null;
  description: string | null;
  createdAt: string;
}

export interface TransactionsResponse {
  transactions: CurrencyTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UseCurrencyTransactionsOptions {
  userId?: string;
  currencyType?: CurrencyType;
  transactionType?: TransactionType;
}

export function useCurrencyTransactions(
  guildId: string,
  page: number = 1,
  limit: number = 20,
  options?: UseCurrencyTransactionsOptions
) {
  return useQuery({
    queryKey: ["currency-transactions", guildId, page, limit, options],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (options?.userId) {
        params.set("userId", options.userId);
      }
      if (options?.currencyType) {
        params.set("currencyType", options.currencyType);
      }
      if (options?.transactionType) {
        params.set("type", options.transactionType);
      }
      const response = await apiClient.get<TransactionsResponse>(
        `/api/guilds/${guildId}/currency/transactions?${params.toString()}`
      );
      return response.data;
    },
    enabled: !!guildId,
  });
}
