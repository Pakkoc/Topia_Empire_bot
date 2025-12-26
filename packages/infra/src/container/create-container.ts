import {
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
import { getPool } from '../database/pool';
import {
  XpRepository,
  XpSettingsRepository,
  TopyWalletRepository,
  RubyWalletRepository,
  CurrencySettingsRepository,
  CurrencyTransactionRepository,
  DailyRewardRepository,
  ShopRepository,
  MarketRepository,
  MarketSettingsRepository,
  BankSubscriptionRepository,
  ShopV2Repository,
  RoleTicketRepository,
} from '../database/repositories';
import { SystemClock } from '../clock';
import type { Container } from './types';

export function createContainer(): Container {
  const pool = getPool();

  // Infrastructure
  const clock = new SystemClock();

  // XP Repositories
  const xpRepo = new XpRepository(pool);
  const xpSettingsRepo = new XpSettingsRepository(pool);

  // Currency Repositories
  const topyWalletRepo = new TopyWalletRepository(pool);
  const rubyWalletRepo = new RubyWalletRepository(pool);
  const currencySettingsRepo = new CurrencySettingsRepository(pool);
  const currencyTransactionRepo = new CurrencyTransactionRepository(pool);
  const dailyRewardRepo = new DailyRewardRepository(pool);
  const shopRepo = new ShopRepository(pool);
  const marketRepo = new MarketRepository(pool);
  const marketSettingsRepo = new MarketSettingsRepository(pool);
  const bankSubscriptionRepo = new BankSubscriptionRepository(pool);

  // V2 Repositories
  const shopV2Repo = new ShopV2Repository(pool);
  const roleTicketRepo = new RoleTicketRepository(pool);

  // Services
  const xpService = new XpService(xpRepo, xpSettingsRepo, clock);
  const currencyService = new CurrencyService(
    topyWalletRepo,
    rubyWalletRepo,
    currencySettingsRepo,
    currencyTransactionRepo,
    clock,
    dailyRewardRepo
  );
  const shopService = new ShopService(
    shopRepo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    clock,
    bankSubscriptionRepo
  );
  const marketService = new MarketService(
    marketRepo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    clock
  );
  const marketSettingsService = new MarketSettingsService(marketSettingsRepo);
  const bankService = new BankService(bankSubscriptionRepo, clock);

  // V2 Services
  const shopV2Service = new ShopV2Service(
    shopV2Repo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    clock
  );
  const roleTicketService = new RoleTicketService(roleTicketRepo, shopV2Repo);
  const inventoryService = new InventoryService(shopV2Repo, roleTicketRepo, clock);

  return {
    xpService,
    currencyService,
    shopService,
    marketService,
    marketSettingsService,
    bankService,

    // V2 역할선택권 시스템
    shopV2Service,
    roleTicketService,
    inventoryService,
  };
}
