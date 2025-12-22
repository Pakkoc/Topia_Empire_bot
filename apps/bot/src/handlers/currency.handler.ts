import type { Client } from 'discord.js';
import type { Container } from '@topia/infra';

export function createCurrencyHandler(container: Container, client: Client) {
  return {
    /**
     * 텍스트 메시지 보상 처리
     */
    async handleTextMessage(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[],
      messageLength: number
    ): Promise<void> {
      const result = await container.currencyService.grantTextCurrency(
        guildId,
        userId,
        channelId,
        roleIds,
        messageLength
      );

      if (!result.success) {
        console.error('[CURRENCY] Text grant error:', result.error);
        return;
      }

      if (result.data.granted) {
        console.log(
          `[CURRENCY] ${userId} earned ${result.data.amount} topy (balance: ${result.data.totalBalance}, daily: ${result.data.dailyEarned})`
        );
      }
      // 차단 사유는 로그하지 않음 (노이즈 감소)
    },

    /**
     * 음성 보상 처리 (1분 주기)
     */
    async handleVoiceReward(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[]
    ): Promise<void> {
      const result = await container.currencyService.grantVoiceCurrency(
        guildId,
        userId,
        channelId,
        roleIds
      );

      if (!result.success) {
        console.error('[CURRENCY] Voice grant error:', result.error);
        return;
      }

      if (result.data.granted) {
        console.log(
          `[CURRENCY VOICE] ${userId} earned ${result.data.amount} topy (balance: ${result.data.totalBalance}, daily: ${result.data.dailyEarned})`
        );
      }
      // 차단 사유는 로그하지 않음 (노이즈 감소)
    },
  };
}
