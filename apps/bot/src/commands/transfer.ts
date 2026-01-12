import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
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

    await interaction.deferReply({ ephemeral: true });

    try {
      // 화폐 설정 가져오기
      const settingsResult = await container.currencyService.getSettings(guildId);
      const settings = settingsResult.success ? settingsResult.data : null;
      const topyName = settings?.topyName || '토피';
      const rubyName = settings?.rubyName || '루비';
      const currencyName = currencyType === 'topy' ? topyName : rubyName;
      const logChannelId = settings?.currencyLogChannelId;

      // 수수료 미리 계산
      const feeResult = await container.currencyService.calculateTransferFee(guildId, BigInt(amount), currencyType);
      const expectedFee = feeResult.success ? feeResult.data.fee : BigInt(0);

      // 이체수수료감면권 확인 (토피만 수수료 있음)
      let usedReductionItem = false;
      let reductionPercent = 0; // 감면 비율 (0 = 감면 안함, 100 = 완전 면제)

      if (expectedFee > BigInt(0)) {
        const reductionResult = await container.shopV2Service.checkTransferFeeReduction(guildId, senderId);

        if (reductionResult.success && reductionResult.data.hasReduction) {
          const itemReductionPercent = reductionResult.data.reductionPercent;
          const isFullExempt = itemReductionPercent >= 100;

          // 감면 후 예상 수수료 계산
          const reducedFee = isFullExempt
            ? BigInt(0)
            : (expectedFee * BigInt(100 - itemReductionPercent)) / BigInt(100);
          const savedFee = expectedFee - reducedFee;

          // 버튼 라벨 설정
          const useButtonLabel = isFullExempt
            ? `감면권 사용 (${expectedFee.toLocaleString()} ${currencyName} 면제)`
            : `감면권 사용 (${savedFee.toLocaleString()} ${currencyName} 감면, 수수료 ${reducedFee.toLocaleString()})`;

          // 버튼 UI 표시
          const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('use_reduction')
                .setLabel(useButtonLabel)
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('skip_reduction')
                .setLabel(`그냥 이체 (수수료 ${expectedFee.toLocaleString()} ${currencyName})`)
                .setStyle(ButtonStyle.Secondary),
            );

          const reductionText = isFullExempt
            ? '100% 면제'
            : `${itemReductionPercent}% 감면 (${savedFee.toLocaleString()} ${currencyName} 절약)`;

          const confirmContainer = new ContainerBuilder()
            .setAccentColor(0xFFAA00)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# 💳 이체수수료감면권 보유')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `이체 금액: **${amount.toLocaleString()} ${currencyName}**\n` +
                `기본 수수료: **${expectedFee.toLocaleString()} ${currencyName}**\n` +
                `감면권 효과: **${reductionText}**\n\n` +
                `이체수수료감면권을 사용하시겠습니까?`
              )
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('-# 30초 내에 선택해주세요')
            );

          const response = await interaction.editReply({
            components: [confirmContainer.toJSON(), row],
            flags: MessageFlags.IsComponentsV2,
          });

          try {
            const buttonInteraction = await response.awaitMessageComponent({
              componentType: ComponentType.Button,
              filter: (i) => i.user.id === senderId,
              time: 30_000,
            });

            if (buttonInteraction.customId === 'use_reduction') {
              // 감면권 사용
              const userItemId = reductionResult.data.userItemId!;
              await container.shopV2Service.useTransferFeeReduction(guildId, senderId, userItemId);
              reductionPercent = itemReductionPercent;
              usedReductionItem = true;
            }

            await buttonInteraction.deferUpdate();
          } catch {
            // 시간 초과 - 일반 이체로 진행
            const timeoutContainer = new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('# ⏰ 시간 초과')
              )
              .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
              )
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('선택 시간이 초과되어 이체가 취소되었습니다.')
              );

            await interaction.editReply({
              components: [timeoutContainer.toJSON()],
              flags: MessageFlags.IsComponentsV2,
            });
            return;
          }
        }
      }

      const result = await container.currencyService.transfer(
        guildId,
        senderId,
        receiver.id,
        BigInt(amount),
        currencyType,
        reason ?? undefined,
        false, // skipFee는 하위호환용, feeReductionPercent 사용
        usedReductionItem ? reductionPercent : undefined
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

        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xFF0000)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# ❌ 이체 실패')
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

      const { amount: transferAmount, fee, fromBalance, toBalance } = result.data;
      const totalDeducted = transferAmount + fee;
      const hasFee = fee > BigInt(0);
      const reasonText = reason ? `\n📝 사유: ${reason}` : '';
      const reductionText = usedReductionItem ? '\n🎫 이체수수료감면권 사용 (수수료 면제)' : '';

      // 채널 응답
      let replyDescription: string;
      if (usedReductionItem) {
        replyDescription = `**${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.${reductionText}${reasonText}`;
      } else if (hasFee) {
        replyDescription = `**${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.\n총 **${totalDeducted.toLocaleString()} ${currencyName}** 차감 (송금 ${transferAmount.toLocaleString()} + 수수료 ${fee.toLocaleString()})${reasonText}`;
      } else {
        replyDescription = `**${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.${reasonText}`;
      }

      const successContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ✅ 이체 완료!')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(replyDescription)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`💰 **남은 잔액**: ${fromBalance.toLocaleString()} ${currencyName}`)
        );

      // 알림 채널이 설정되어 있으면 해당 채널로 전송
      if (logChannelId) {
        const logChannel = await interaction.guild?.channels.fetch(logChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
          // 로그 채널용 메시지 (멘션으로 표시)
          const logContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# 💸 이체 내역')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `<@${interaction.user.id}> → <@${receiver.id}>\n` +
                `금액: **${transferAmount.toLocaleString()} ${currencyName}**` +
                (hasFee && !usedReductionItem ? `\n수수료: **${fee.toLocaleString()} ${currencyName}**` : '') +
                (usedReductionItem ? '\n🎫 감면권 사용' : '') +
                (reason ? `\n📝 사유: ${reason}` : '')
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
        components: [successContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });

      // DM 알림 발송 (실패해도 무시)
      const guildName = interaction.guild?.name ?? '서버';

      // 보내는 사람에게 DM
      let senderDmDescription: string;
      if (usedReductionItem) {
        senderDmDescription = `**${guildName}**에서 **${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.${reductionText}${reason ? `\n📝 사유: ${reason}` : ''}`;
      } else if (hasFee) {
        senderDmDescription = `**${guildName}**에서 **${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.\n총 **${totalDeducted.toLocaleString()} ${currencyName}** 차감 (송금 ${transferAmount.toLocaleString()} + 수수료 ${fee.toLocaleString()})${reason ? `\n📝 사유: ${reason}` : ''}`;
      } else {
        senderDmDescription = `**${guildName}**에서 **${receiver.displayName}**님에게 **${transferAmount.toLocaleString()} ${currencyName}**를 보냈습니다.${reason ? `\n📝 사유: ${reason}` : ''}`;
      }

      const senderDmContainer = new ContainerBuilder()
        .setAccentColor(0xFFA500)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 💸 이체 알림')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(senderDmDescription)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`💰 **남은 잔액**: ${fromBalance.toLocaleString()} ${currencyName}`)
        );

      interaction.user.send({
        components: [senderDmContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});

      // 받는 사람에게 DM
      const receiverDmContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 💰 입금 알림')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${guildName}**에서 **${interaction.user.displayName}**님에게서 **${transferAmount.toLocaleString()} ${currencyName}**를 받았습니다.${reason ? `\n📝 사유: ${reason}` : ''}`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`💰 **현재 잔액**: ${toBalance.toLocaleString()} ${currencyName}`)
        );

      receiver.send({
        components: [receiverDmContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    } catch (error) {
      console.error('이체 명령어 오류:', error);
      const errorContainer = new ContainerBuilder()
        .setAccentColor(0xFF0000)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ❌ 오류 발생')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('이체 처리 중 오류가 발생했습니다.')
        );

      await interaction.editReply({
        components: [errorContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
