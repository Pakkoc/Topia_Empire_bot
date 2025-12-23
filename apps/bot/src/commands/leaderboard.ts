import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from './types';

const MEDALS = ['', '', ''];

// 이모지 제거 함수
function removeEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
}

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('랭킹')
    .setDescription('화폐 보유량 상위 유저를 조회합니다')
    .addIntegerOption(option =>
      option
        .setName('페이지')
        .setDescription('페이지 번호 (기본: 1)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    ),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const page = interaction.options.getInteger('페이지') ?? 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    // 설정에서 화폐 이름 가져오기
    const settingsResult = await container.currencyService.getSettings(guildId);
    const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
    const topyNameClean = removeEmoji(topyName);

    const result = await container.currencyService.getLeaderboard(guildId, limit, offset);

    if (!result.success) {
      await interaction.editReply({
        content: '랭킹 정보를 불러오는 중 오류가 발생했습니다.',
      });
      return;
    }

    const wallets = result.data;

    if (wallets.length === 0) {
      await interaction.editReply({
        content: '아직 랭킹 정보가 없습니다.',
      });
      return;
    }

    const lines: string[] = [];

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      if (!wallet) continue;

      const rank = offset + i + 1;
      const medal = MEDALS[rank - 1] ?? `\`${rank}.\``;

      try {
        const user = await interaction.client.users.fetch(wallet.userId);
        lines.push(
          `${medal} **${user.displayName}** - ${wallet.balance.toLocaleString()} ${topyNameClean}`
        );
      } catch {
        lines.push(
          `${medal} <@${wallet.userId}> - ${wallet.balance.toLocaleString()} ${topyNameClean}`
        );
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${topyName} 랭킹`)
      .setColor(0xFFD700)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `페이지 ${page}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
