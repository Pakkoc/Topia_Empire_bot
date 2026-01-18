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
  | { type: 'OUT_OF_STOCK'; available?: number; requested?: number }
  | { type: 'PURCHASE_LIMIT_EXCEEDED'; maxPerUser: number; currentCount: number; requested?: number }
  | { type: 'INVALID_QUANTITY' }
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
  | { type: 'INSUFFICIENT_QUANTITY'; required: number; available: number }
  // 화폐 관리자 에러
  | { type: 'NOT_CURRENCY_MANAGER' }
  | { type: 'MANAGER_FEATURE_DISABLED'; currencyType: 'topy' | 'ruby' }
  // 내전 시스템 관련 에러
  | { type: 'GAME_NOT_FOUND' }
  | { type: 'GAME_NOT_OPEN' }
  | { type: 'GAME_NOT_PENDING' }
  | { type: 'GAME_ALREADY_FINISHED' }
  | { type: 'ALREADY_JOINED' }
  | { type: 'NOT_PARTICIPANT'; userId?: string }
  | { type: 'CATEGORY_NOT_FOUND' }
  | { type: 'INVALID_TEAM_NUMBER' }
  | { type: 'UNASSIGNED_PARTICIPANTS'; count: number }
  | { type: 'GAME_FULL'; maxPlayers: number; currentPlayers: number }
  | { type: 'TEAM_FULL'; teamNumber: number; maxPlayers: number; currentPlayers: number }
  // 세금 관련 에러
  | { type: 'ALREADY_PROCESSED' }
  // 금고 관련 에러
  | { type: 'NO_SUBSCRIPTION' }
  | { type: 'VAULT_LIMIT_EXCEEDED'; limit: bigint; current: bigint; requested: bigint }
  | { type: 'INSUFFICIENT_VAULT_BALANCE'; required: bigint; available: bigint }
  // 금고 구독 관련 에러
  | { type: 'INVALID_ITEM_CONFIG' }
  | { type: 'CANNOT_DOWNGRADE_SUBSCRIPTION'; currentTier: string; newTier: string };
