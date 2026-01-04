import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';

export const vaultCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('금고')
    .setDescription('디토뱅크 금고를 관리합니다')
    .addSubcommand(subcommand =>
      subcommand
        .setName('확인')
        .setDescription('금고 현황을 확인합니다')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('예금')
        .setDescription('금고에 토피를 예금합니다')
        .addIntegerOption(option =>
          option
            .setName('금액')
            .setDescription('예금할 금액')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('출금')
        .setDescription('금고에서 토피를 출금합니다')
        .addIntegerOption(option =>
          option
            .setName('금액')
            .setDescription('출금할 금액')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // 화폐 설정 가져오기
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';

      if (subcommand === '확인') {
        const result = await container.vaultService.getVaultSummary(guildId, userId);

        if (!result.success) {
          await interaction.editReply({
            content: '금고 정보를 불러오는 중 오류가 발생했습니다.',
          });
          return;
        }

        const { vault, storageLimit, interestRate, tierName } = result.data;

        if (!vault && storageLimit === BigInt(0)) {
          const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🔒 금고 이용 불가')
            .setDescription(
              '금고는 **디토 실버** 또는 **디토 골드** 구독자만 이용할 수 있습니다.\n\n' +
              '상점에서 디토뱅크 구독권을 구매해보세요!'
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const depositedAmount = vault?.depositedAmount ?? BigInt(0);
        const remainingLimit = storageLimit - depositedAmount;

        const embed = new EmbedBuilder()
          .setColor(0x00BFFF)
          .setTitle('🏦 내 금고')
          .setDescription(`**${tierName}** 구독 혜택`)
          .addFields(
            { name: '💰 예치금', value: `${depositedAmount.toLocaleString()} ${topyName}`, inline: true },
            { name: '📊 한도', value: `${storageLimit.toLocaleString()} ${topyName}`, inline: true },
            { name: '📈 월 이자율', value: `${interestRate}%`, inline: true },
            { name: '🔓 남은 한도', value: `${remainingLimit.toLocaleString()} ${topyName}`, inline: false },
          )
          .setFooter({ text: '매월 1일에 이자가 지급됩니다' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } else if (subcommand === '예금') {
        const amount = interaction.options.getInteger('금액', true);

        const result = await container.vaultService.deposit(guildId, userId, BigInt(amount));

        if (!result.success) {
          let errorMessage = '예금 처리 중 오류가 발생했습니다.';

          switch (result.error.type) {
            case 'NO_SUBSCRIPTION':
              errorMessage = '금고는 디토뱅크 구독자만 이용할 수 있습니다.';
              break;
            case 'VAULT_LIMIT_EXCEEDED':
              const limit = result.error.limit;
              const current = result.error.current;
              const remaining = limit - current;
              errorMessage = `금고 한도를 초과했습니다.\n현재 예치: ${current.toLocaleString()} ${topyName}\n한도: ${limit.toLocaleString()} ${topyName}\n남은 한도: ${remaining.toLocaleString()} ${topyName}`;
              break;
            case 'INSUFFICIENT_BALANCE':
              errorMessage = `잔액이 부족합니다.\n필요: ${result.error.required.toLocaleString()} ${topyName}\n보유: ${result.error.available.toLocaleString()} ${topyName}`;
              break;
            case 'INVALID_AMOUNT':
              errorMessage = result.error.message;
              break;
          }

          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 예금 실패')
            .setDescription(errorMessage)
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const { depositedAmount, newTotal } = result.data;

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ 예금 완료!')
          .setDescription(`금고에 **${depositedAmount.toLocaleString()} ${topyName}**를 예금했습니다.`)
          .addFields(
            { name: '💰 금고 잔액', value: `${newTotal.toLocaleString()} ${topyName}`, inline: true },
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } else if (subcommand === '출금') {
        const amount = interaction.options.getInteger('금액', true);

        const result = await container.vaultService.withdraw(guildId, userId, BigInt(amount));

        if (!result.success) {
          let errorMessage = '출금 처리 중 오류가 발생했습니다.';

          switch (result.error.type) {
            case 'INSUFFICIENT_VAULT_BALANCE':
              errorMessage = `금고 잔액이 부족합니다.\n필요: ${result.error.required.toLocaleString()} ${topyName}\n금고 잔액: ${result.error.available.toLocaleString()} ${topyName}`;
              break;
            case 'INVALID_AMOUNT':
              errorMessage = result.error.message;
              break;
          }

          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 출금 실패')
            .setDescription(errorMessage)
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const { withdrawnAmount, newTotal } = result.data;

        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ 출금 완료!')
          .setDescription(`금고에서 **${withdrawnAmount.toLocaleString()} ${topyName}**를 출금했습니다.`)
          .addFields(
            { name: '💰 금고 잔액', value: `${newTotal.toLocaleString()} ${topyName}`, inline: true },
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('금고 명령어 오류:', error);
      await interaction.editReply({
        content: '금고 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
