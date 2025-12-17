import type { Container } from '@topia/infra';

export function createXpHandler(container: Container) {
  return {
    async handleTextMessage(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[]
    ): Promise<void> {
      const result = await container.xpService.grantTextXp(
        guildId,
        userId,
        channelId,
        roleIds
      );

      if (!result.success) {
        console.error('XP grant error:', result.error);
        return;
      }

      if (result.data.granted) {
        console.log(
          `[XP] ${userId} earned ${result.data.xp} XP (total: ${result.data.totalXp}, level: ${result.data.level})`
        );

        if (result.data.leveledUp) {
          console.log(`[LEVEL UP] ${userId} reached level ${result.data.level}!`);
          // TODO: 레벨업 알림 전송
        }
      }
    },
  };
}
