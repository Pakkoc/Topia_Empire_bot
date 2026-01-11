import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
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
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('사유')
        .setDescription('지급 사유 (선택)')
        .setRequired(false)
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

    await interaction.deferReply({ ephemeral: true });

    try {
      // 화폐 설정 가져오기
      const settingsResult = await container.currencyService.getSettings(guildId);
      const settings = settingsResult.success ? settingsResult.data : null;
      const topyName = settings?.topyName || '토피';
      const rubyName = settings?.rubyName || '루비';
      const currencyName = currencyType === 'topy' ? topyName : rubyName;
      const logChannelId = settings?.currencyLogChannelId;

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
            errorMessage = `${currencyName} 관리자만 이 명령어를 사용할 수 있습니다.`;
            break;
          case 'MANAGER_FEATURE_DISABLED':
            errorMessage = `${currencyName} 관리자 기능이 비활성화되어 있습니다.`;
            break;
          case 'INVALID_AMOUNT':
            errorMessage = result.error.message;
            break;
        }

        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xFF0000)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# ❌ 지급 실패')
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(errorMessage)
          );

        await interaction.editReply({
          components: [errorContainer.toJSON()],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      const { newBalance } = result.data;
      const reasonText = description ? `\n📝 **사유**: ${description}` : '';

      const successContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ✅ 지급 완료!')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${targetUser.displayName}**님에게 **${amount.toLocaleString()} ${currencyName}**를 지급했습니다.`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `💰 **지급 후 잔액**: ${newBalance.toLocaleString()} ${currencyName}${reasonText}`
          )
        );

      // 알림 채널이 설정되어 있으면 해당 채널로 전송
      if (logChannelId) {
        const logChannel = await interaction.guild?.channels.fetch(logChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
          const logContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# 💵 지급 내역')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `<@${interaction.user.id}>(관리자) → <@${targetUser.id}>\n` +
                `금액: **+${amount.toLocaleString()} ${currencyName}**` +
                (description ? `\n📝 사유: ${description}` : '')
              )
            );

          await logChannel.send({
            components: [logContainer.toJSON()],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }

      // 명령어 실행 채널에는 ephemeral로 응답
      await interaction.editReply({
        content: `✅ **${targetUser.displayName}**님에게 **${amount.toLocaleString()} ${currencyName}**를 지급했습니다.`,
      });

      // 받는 사람에게 DM 알림 (실패해도 무시)
      const guildName = interaction.guild?.name ?? '서버';
      const dmReasonText = description ? `\n📝 사유: ${description}` : '';

      const dmContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 💰 지급 알림')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${guildName}**에서 관리자가 **${amount.toLocaleString()} ${currencyName}**를 지급했습니다.${dmReasonText}`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `💰 **현재 잔액**: ${newBalance.toLocaleString()} ${currencyName}`
          )
        );

      targetUser.send({
        components: [dmContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    } catch (error) {
      console.error('지급 명령어 오류:', error);
      await interaction.editReply({
        content: '지급 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
