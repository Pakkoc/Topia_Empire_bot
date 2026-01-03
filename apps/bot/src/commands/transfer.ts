import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';

export const transferCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('이체')
    .setDescription('다른 유저에게 화폐를 송금합니다')
    .addUserOption(option =>
      option
        .setName('받는사람')
        .setDescription('송금할 유저')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('금액')
        .setDescription('송금할 금액')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('화폐')
        .setDescription('송금할 화폐 종류')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('사유')
        .setDescription('이체 사유 (선택)')
        .setRequired(false)
        .setMaxLength(100)
    ),

  async autocomplete(interaction, container) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.respond([]);
      return;
    }

    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === '화폐') {
      try {
        // 서버의 화폐 설정 조회
        const settingsResult = await container.currencyService.getSettings(guildId);
        const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
        const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

        await interaction.respond([
          { name: topyName, value: 'topy' },
          { name: rubyName, value: 'ruby' },
        ]);
      } catch {
        // 에러 시 기본값 반환
        await interaction.respond([
          { name: '토피', value: 'topy' },
          { name: '루비', value: 'ruby' },
        ]);
      }
    } else {
      await interaction.respond([]);
    }
  },

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const senderId = interaction.user.id;
    const receiver = interaction.options.getUser('받는사람', true);
    const amount = interaction.options.getInteger('금액', true);
    const currencyType = interaction.options.getString('화폐', true) as 'topy' | 'ruby';
    const reason = interaction.options.getString('사유');

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 봇에게 송금 불가
    if (receiver.bot) {
      await interaction.reply({
        content: '봇에게는 송금할 수 없습니다.',
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

      const result = await container.currencyService.transfer(
        guildId,
        senderId,
        receiver.id,
        BigInt(amount),
        currencyType,
        reason ?? undefined
      );

      if (!result.success) {
        let errorMessage = '이체 처리 중 오류가 발생했습니다.';

        switch (result.error.type) {
          case 'SELF_TRANSFER':
            errorMessage = '자기 자신에게는 이체할 수 없습니다.';
            break;
          case 'INSUFFICIENT_BALANCE':
            const required = result.error.required;
            const available = result.error.available;
            errorMessage = `잔액이 부족합니다.\n필요: ${required.toLocaleString()} ${currencyName}\n보유: ${available.toLocaleString()} ${currencyName}`;
            break;
          case 'INVALID_AMOUNT':
            errorMessage = result.error.message;
            break;
        }

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 이체 실패')
          .setDescription(errorMessage)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const { amount: transferAmount, fee, fromBalance, toBalance } = result.data;
      const totalDeducted = transferAmount + fee;
      const hasFee = fee > BigInt(0);
      const reasonText = reason ? `\n사유: ${reason}` : '';

      // 채널 응답
      const replyDescription = hasFee
        ? `**${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.\n총 **${totalDeducted.toLocaleString()} ${currencyName}** 차감 (송금 ${transferAmount.toLocaleString()} + 수수료 ${fee.toLocaleString()})${reasonText}`
        : `**${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.${reasonText}`;

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ 이체 완료!')
        .setDescription(replyDescription)
        .addFields(
          { name: '💰 남은 잔액', value: `${fromBalance.toLocaleString()} ${currencyName}`, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // DM 알림 발송 (실패해도 무시)
      const guildName = interaction.guild?.name ?? '서버';

      // 보내는 사람에게 DM
      const senderDmDescription = hasFee
        ? `**${guildName}**에서 **${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.\n총 **${totalDeducted.toLocaleString()} ${currencyName}** 차감 (송금 ${transferAmount.toLocaleString()} + 수수료 ${fee.toLocaleString()})${reasonText}`
        : `**${guildName}**에서 **${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.${reasonText}`;

      const senderDmEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('💸 이체 알림')
        .setDescription(senderDmDescription)
        .addFields(
          { name: '💰 남은 잔액', value: `${fromBalance.toLocaleString()} ${currencyName}`, inline: true },
        )
        .setTimestamp();

      interaction.user.send({ embeds: [senderDmEmbed] }).catch(() => {});

      // 받는 사람에게 DM
      const receiverDmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💰 입금 알림')
        .setDescription(
          `**${guildName}**에서 **${interaction.user.displayName}**님에게서 **${transferAmount.toLocaleString()} ${currencyName}**를 받았습니다.${reasonText}`
        )
        .addFields(
          { name: '💰 현재 잔액', value: `${toBalance.toLocaleString()} ${currencyName}`, inline: true },
        )
        .setTimestamp();

      receiver.send({ embeds: [receiverDmEmbed] }).catch(() => {});
    } catch (error) {
      console.error('이체 명령어 오류:', error);
      await interaction.editReply({
        content: '이체 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
