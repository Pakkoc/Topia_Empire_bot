import type {
  XpService,
  CurrencyService,
  ShopService,
  MarketService,
  MarketSettingsService,
  BankService,
  RoleTicketService,
  InventoryService,
  GameService,
  TaxService,
  ShopPanelService,
  DataRetentionService,
  VaultService,
} from '@topia/core';
import type { ActivityLogRepositoryPort } from '../database/repositories/activity-log.repository';

export interface Container {
  xpService: XpService;
  currencyService: CurrencyService;
  shopService: ShopService;
  marketService: MarketService;
  marketSettingsService: MarketSettingsService;
  bankService: BankService;

  // V2 역할선택권 시스템 (ShopService로 통합됨)
  shopV2Service: ShopService;
  roleTicketService: RoleTicketService;
  inventoryService: InventoryService;

  // 게임센터
  gameService: GameService;

  // 세금
  taxService: TaxService;

  // 상점 패널
  shopPanelService: ShopPanelService;

  // 데이터 보존
  dataRetentionService: DataRetentionService;

  // 금고
  vaultService: VaultService;

  // 활동 로그
  activityLogRepo: ActivityLogRepositoryPort;
}
