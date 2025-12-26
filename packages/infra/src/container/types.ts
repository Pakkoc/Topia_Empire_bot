import type {
  XpService,
  CurrencyService,
  ShopService,
  MarketService,
  MarketSettingsService,
  BankService,
  ShopV2Service,
  RoleTicketService,
  InventoryService,
} from '@topia/core';

export interface Container {
  xpService: XpService;
  currencyService: CurrencyService;
  shopService: ShopService;
  marketService: MarketService;
  marketSettingsService: MarketSettingsService;
  bankService: BankService;

  // V2 역할선택권 시스템
  shopV2Service: ShopV2Service;
  roleTicketService: RoleTicketService;
  inventoryService: InventoryService;
}
