/**
 * 화폐 타입
 */
export type CurrencyType = 'topy' | 'ruby';

/**
 * 거래 타입
 */
export type TransactionType =
  | 'earn_text'      // 텍스트 채팅 보상
  | 'earn_voice'     // 음성 채팅 보상
  | 'earn_attendance' // 출석 보상
  | 'transfer_in'    // 송금 받음
  | 'transfer_out'   // 송금 보냄
  | 'shop_purchase'  // 상점 구매
  | 'tax'            // 세금
  | 'fee'            // 수수료
  | 'admin_add'      // 관리자 추가
  | 'admin_remove';  // 관리자 제거

/**
 * 화폐 거래 기록
 */
export interface CurrencyTransaction {
  id: bigint;
  guildId: string;
  userId: string;
  currencyType: CurrencyType;
  transactionType: TransactionType;
  amount: bigint;
  balanceAfter: bigint;
  fee: bigint;
  relatedUserId: string | null;
  description: string | null;
  createdAt: Date;
}

export function createTransaction(
  guildId: string,
  userId: string,
  currencyType: CurrencyType,
  transactionType: TransactionType,
  amount: bigint,
  balanceAfter: bigint,
  options?: {
    fee?: bigint;
    relatedUserId?: string;
    description?: string;
  }
): Omit<CurrencyTransaction, 'id' | 'createdAt'> {
  return {
    guildId,
    userId,
    currencyType,
    transactionType,
    amount,
    balanceAfter,
    fee: options?.fee ?? BigInt(0),
    relatedUserId: options?.relatedUserId ?? null,
    description: options?.description ?? null,
  };
}
