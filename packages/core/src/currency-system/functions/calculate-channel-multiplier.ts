import { CURRENCY_DEFAULTS } from '@topia/shared';
import type { ChannelCategory } from '../domain/channel-category';

/**
 * 채널 카테고리에 따른 배율 반환
 */
export function getChannelCategoryMultiplier(category: ChannelCategory): number {
  return CURRENCY_DEFAULTS.CHANNEL_CATEGORY_MULTIPLIERS[category];
}
