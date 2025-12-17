import { XpService } from '@topia/core';
import { getPool } from '../database/pool';
import { XpRepository, XpSettingsRepository } from '../database/repositories';
import { SystemClock } from '../clock';
import type { Container } from './types';

export function createContainer(): Container {
  const pool = getPool();

  // Infrastructure
  const clock = new SystemClock();

  // Repositories
  const xpRepo = new XpRepository(pool);
  const xpSettingsRepo = new XpSettingsRepository(pool);

  // Services
  const xpService = new XpService(xpRepo, xpSettingsRepo, clock);

  return {
    xpService,
  };
}
