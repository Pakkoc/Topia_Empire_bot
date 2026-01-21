import {
  XpService,
  CurrencyService,
  ShopService,
  BankService,
  ShopV2Service,
  RoleTicketService,
  InventoryService,
  GameService,
  TaxService,
  ShopPanelService,
  DataRetentionService,
  VaultService,
  createTreasuryService,
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
  BankSubscriptionRepository,
  ShopV2Repository,
  RoleTicketRepository,
  CurrencyManagerRepository,
  GameRepository,
  TaxHistoryRepository,
  ShopPanelSettingsRepository,
  DataRetentionSettingsRepository,
  LeftMemberRepository,
  UserDataCleanupRepository,
  VaultRepository,
  ActivityLogRepository,
  TreasuryRepository,
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
  const bankSubscriptionRepo = new BankSubscriptionRepository(pool);

  // V2 Repositories
  const shopV2Repo = new ShopV2Repository(pool);
  const roleTicketRepo = new RoleTicketRepository(pool);

  // 화폐 관리자
  const currencyManagerRepo = new CurrencyManagerRepository(pool);

  // 게임센터
  const gameRepo = new GameRepository(pool);

  // 세금
  const taxHistoryRepo = new TaxHistoryRepository(pool);

  // 상점 패널
  const shopPanelSettingsRepo = new ShopPanelSettingsRepository(pool);

  // 데이터 보존
  const dataRetentionSettingsRepo = new DataRetentionSettingsRepository(pool);
  const leftMemberRepo = new LeftMemberRepository(pool);
  const userDataCleanupRepo = new UserDataCleanupRepository(pool);

  // 금고
  const vaultRepo = new VaultRepository(pool);

  // 활동 로그
  const activityLogRepo = new ActivityLogRepository(pool);

  // 국고
  const treasuryRepo = new TreasuryRepository(pool);

  // Services (repositories needed for tax service)
  const xpService = new XpService(xpRepo, xpSettingsRepo, clock);
  const currencyService = new CurrencyService(
    topyWalletRepo,
    rubyWalletRepo,
    currencySettingsRepo,
    currencyTransactionRepo,
    clock,
    dailyRewardRepo,
    currencyManagerRepo,
    treasuryRepo
  );
  const shopService = new ShopService(
    shopRepo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    currencySettingsRepo,
    clock,
    bankSubscriptionRepo,
    undefined, // roleTicketRepo
    treasuryRepo
  );
  const bankService = new BankService(bankSubscriptionRepo, clock);

  // V2 Services
  const shopV2Service = new ShopV2Service(
    shopV2Repo,
    topyWalletRepo,
    rubyWalletRepo,
    currencyTransactionRepo,
    currencySettingsRepo,
    clock,
    bankSubscriptionRepo,
    roleTicketRepo, // fixedRoleId 자동 적용용
    treasuryRepo
  );
  const roleTicketService = new RoleTicketService(roleTicketRepo, shopV2Repo);
  const inventoryService = new InventoryService(shopV2Repo, roleTicketRepo, clock);

  // 게임센터 서비스
  const gameService = new GameService(
    gameRepo,
    topyWalletRepo,
    currencyTransactionRepo
  );

  // 세금 서비스
  const taxService = new TaxService(
    currencySettingsRepo,
    topyWalletRepo,
    currencyTransactionRepo,
    taxHistoryRepo,
    shopRepo,
    clock,
    treasuryRepo
  );

  // 상점 패널 서비스
  const shopPanelService = new ShopPanelService(shopPanelSettingsRepo);

  // 데이터 보존 서비스
  const dataRetentionService = new DataRetentionService(
    dataRetentionSettingsRepo,
    leftMemberRepo,
    userDataCleanupRepo
  );

  // 금고 서비스
  const vaultService = new VaultService(
    vaultRepo,
    topyWalletRepo,
    currencyTransactionRepo,
    bankSubscriptionRepo,
    clock
  );

  // 국고 서비스
  const treasuryService = createTreasuryService(treasuryRepo);

  return {
    xpService,
    currencyService,
    shopService,
    bankService,

    // V2 역할선택권 시스템
    shopV2Service,
    roleTicketService,
    inventoryService,

    // 게임센터
    gameService,

    // 세금
    taxService,

    // 상점 패널
    shopPanelService,

    // 데이터 보존
    dataRetentionService,

    // 금고
    vaultService,

    // 활동 로그
    activityLogRepo,

    // 국고
    treasuryService,
  };
}
