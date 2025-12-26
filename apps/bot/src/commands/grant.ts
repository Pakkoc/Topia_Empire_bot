import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';

export const grantCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('지급')
    .setDescription('유저에게 화폐를 지급합니다 (화폐 관리자 전용)')
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('지급받을 유저')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('금액')
        .setDescription('지급할 금액')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('화폐')
        .setDescription('지급할 화폐 종류')
        .setRequired(true)
        .addChoices(
          { name: '유상 화폐', value: 'topy' },
          { name: '무상 화폐', value: 'ruby' }
        )
    )
    .addStringOption(option =>
      option
        .setName('사유')
        .setDescription('지급 사유 (선택)')
        .setRequired(false)
    ),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const managerId = interaction.user.id;
    const targetUser = interaction.options.getUser('유저', true);
    const amount = interaction.options.getInteger('금액', true);
    const currencyType = interaction.options.getString('화폐', true) as 'topy' | 'ruby';
    const description = interaction.options.getString('사유') ?? undefined;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 봇에게 지급 불가
    if (targetUser.bot) {
      await interaction.reply({
        content: '봇에게는 지급할 수 없습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // 화폐 설정 가져오기
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
      const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';
      const currencyName = currencyType === 'topy' ? topyName : rubyName;

      const result = await container.currencyService.adminGrantCurrency(
        guildId,
        managerId,
        targetUser.id,
        BigInt(amount),
        currencyType,
        description
      );

      if (!result.success) {
        let errorMessage = '지급 처리 중 오류가 발생했습니다.';

        switch (result.error.type) {
          case 'NOT_CURRENCY_MANAGER':
            errorMessage = '화폐 관리자만 이 명령어를 사용할 수 있습니다.';
            break;
          case 'INVALID_AMOUNT':
            errorMessage = result.error.message;
            break;
        }

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 지급 실패')
          .setDescription(errorMessage)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const { newBalance } = result.data;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ 지급 완료!')
        .setDescription(
          `**${targetUser.displayName}**님에게 **${amount.toLocaleString()} ${currencyName}**를 지급했습니다.`
        )
        .addFields(
          { name: '💰 지급 후 잔액', value: `${newBalance.toLocaleString()} ${currencyName}`, inline: true },
        );

      if (description) {
        embed.addFields({ name: '📝 사유', value: description, inline: false });
      }

      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('지급 명령어 오류:', error);
      await interaction.editReply({
        content: '지급 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
