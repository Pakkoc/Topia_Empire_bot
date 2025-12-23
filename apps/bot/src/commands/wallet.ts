import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from './types';

// 이모지 제거 함수 (모든 이모지 범위 커버)
function removeEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const walletCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('지갑')
    .setDescription('화폐 잔액을 조회합니다')
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('조회할 유저 (미입력 시 본인)')
        .setRequired(false)
    ),

  async execute(interaction, container) {
    const targetUser = interaction.options.getUser('유저') ?? interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 설정에서 화폐 이름 가져오기
    const settingsResult = await container.currencyService.getSettings(guildId);
    const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
    const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

    const result = await container.currencyService.getWallets(guildId, targetUser.id);

    if (!result.success) {
      await interaction.reply({
        content: '지갑 정보를 불러오는 중 오류가 발생했습니다.',
        ephemeral: true,
      });
      return;
    }

    const { topy, ruby } = result.data;
    const topyBalance = topy?.balance ?? BigInt(0);
    const rubyBalance = ruby?.balance ?? BigInt(0);
    const topyTotalEarned = topy?.totalEarned ?? BigInt(0);

    const isSelf = targetUser.id === interaction.user.id;
    const title = isSelf ? '내 지갑' : `${targetUser.displayName}님의 지갑`;

    // value에는 이모지 제거된 이름 사용
    const topyNameClean = removeEmoji(topyName);
    const rubyNameClean = removeEmoji(rubyName);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x5865F2)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: topyNameClean,
          value: `${topyBalance.toLocaleString()} ${topyNameClean}`,
          inline: true,
        },
        {
          name: rubyNameClean,
          value: `${rubyBalance.toLocaleString()} ${rubyNameClean}`,
          inline: true,
        },
        {
          name: `총 획득`,
          value: `${topyTotalEarned.toLocaleString()} ${topyNameClean}`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
