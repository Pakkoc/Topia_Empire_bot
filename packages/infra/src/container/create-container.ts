import { XpService, CurrencyService } from '@topia/core';
import { getPool } from '../database/pool';
import {
  XpRepository,
  XpSettingsRepository,
  TopyWalletRepository,
  RubyWalletRepository,
  CurrencySettingsRepository,
  CurrencyTransactionRepository,
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

  // Services
  const xpService = new XpService(xpRepo, xpSettingsRepo, clock);
  const currencyService = new CurrencyService(
    topyWalletRepo,
    rubyWalletRepo,
    currencySettingsRepo,
    currencyTransactionRepo,
    clock
  );

  return {
    xpService,
    currencyService,
  };
}
