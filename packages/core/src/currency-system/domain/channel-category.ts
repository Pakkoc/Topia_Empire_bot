/**
 * 음성 채널 카테고리 타입
 */
export type ChannelCategory = 'normal' | 'music' | 'afk' | 'premium';

/**
 * 채널 카테고리 설정
 */
export interface ChannelCategoryConfig {
  id: number;
  guildId: string;
  channelId: string;
  category: ChannelCategory;
  createdAt: Date;
}
