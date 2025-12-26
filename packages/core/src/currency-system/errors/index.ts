export type RepositoryError =
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'TIMEOUT'; message: string }
  | { type: 'NOT_FOUND'; message: string };

export type CurrencyError =
  | { type: 'REPOSITORY_ERROR'; cause: RepositoryError }
  | { type: 'SETTINGS_NOT_FOUND'; guildId: string }
  | { type: 'EXCLUDED_CHANNEL'; channelId: string }
  | { type: 'EXCLUDED_ROLE'; roleId: string }
  | { type: 'COOLDOWN_ACTIVE'; remainingSeconds: number }
  | { type: 'CURRENCY_DISABLED'; guildId: string }
  | { type: 'DAILY_LIMIT_REACHED'; limit: number }
  | { type: 'INSUFFICIENT_BALANCE'; required: bigint; available: bigint }
  | { type: 'INVALID_AMOUNT'; message: string }
  | { type: 'MESSAGE_TOO_SHORT'; minLength: number; actualLength: number }
  | { type: 'SELF_TRANSFER' }
  | { type: 'USER_NOT_FOUND'; userId: string }
  | { type: 'ALREADY_CLAIMED'; nextClaimAt: Date }
  // 상점 관련 에러
  | { type: 'ITEM_NOT_FOUND' }
  | { type: 'ITEM_DISABLED' }
  | { type: 'OUT_OF_STOCK' }
  | { type: 'PURCHASE_LIMIT_EXCEEDED'; maxPerUser: number; currentCount: number }
  | { type: 'ITEM_NOT_OWNED' }
  | { type: 'ITEM_EXPIRED' }
  // 장터 관련 에러
  | { type: 'LISTING_NOT_FOUND' }
  | { type: 'LISTING_NOT_ACTIVE' }
  | { type: 'LISTING_EXPIRED' }
  | { type: 'CANNOT_BUY_OWN_LISTING' }
  | { type: 'NOT_LISTING_OWNER' }
  | { type: 'INVALID_PRICE'; minPrice: bigint }
  | { type: 'MAX_LISTINGS_REACHED'; maxListings: number }
  // 뱅크 관련 에러
  | { type: 'BANK_SERVICE_NOT_AVAILABLE' }
  // 색상 관련 에러
  | { type: 'COLOR_NOT_OWNED' }
  | { type: 'COLOR_OPTION_NOT_FOUND' }
  // V2 역할선택권 시스템 에러
  | { type: 'TICKET_NOT_FOUND' }
  | { type: 'TICKET_ALREADY_EXISTS' }
  | { type: 'ROLE_OPTION_NOT_FOUND' }
  | { type: 'INSUFFICIENT_QUANTITY'; required: number; available: number };
