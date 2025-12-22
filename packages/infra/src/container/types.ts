import type { XpService, CurrencyService } from '@topia/core';

export interface Container {
  xpService: XpService;
  currencyService: CurrencyService;
}
