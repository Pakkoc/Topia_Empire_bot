import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import type { Command } from './types';
import { refreshBankPanel } from '../handlers/bank-panel.js';

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
        const settings = settingsResult.success ? settingsResult.data : null;
        const topyName = settings?.topyName || '토피';
        const rubyName = settings?.rubyName || '루비';

        const choices: { name: string; value: string }[] = [];

        // 활성화된 화폐만 표시
        if (settings?.topyManagerEnabled !== false) {
          choices.push({ name: topyName, value: 'topy' });
        }
        if (settings?.rubyManagerEnabled !== false) {
          choices.push({ name: rubyName, value: 'ruby' });
        }

        await interaction.respond(choices);
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

      // 비활성화된 화폐 체크
      const isCurrencyDisabled =
        (currencyType === 'topy' && settings?.topyManagerEnabled === false) ||
        (currencyType === 'ruby' && settings?.rubyManagerEnabled === false);

      if (isCurrencyDisabled) {
        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xFF0000)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# ❌ 이체 불가')
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${currencyName}** 화폐는 현재 비활성화되어 있습니다.`)
          );

        await interaction.editReply({
          components: [errorContainer.toJSON()],
          flags: MessageFlags.IsComponentsV2,
        });
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 300000);
        return;
      }

      // 수수료 미리 계산
      const feeResult = await container.currencyService.calculateTransferFee(guildId, BigInt(amount), currencyType);
      const expectedFee = feeResult.success ? feeResult.data.fee : BigInt(0);

      // 이체수수료감면권 확인 (토피만 수수료 있음)
      let usedReductionItem = false;
      let reductionPercent = 0; // 감면 비율 (0 = 감면 안함, 100 = 완전 면제)

      if (expectedFee > BigInt(0)) {
        const reductionsResult = await container.shopV2Service.getAllTransferFeeReductions(guildId, senderId);

        if (reductionsResult.success && reductionsResult.data.length > 0) {
          const reductions = reductionsResult.data;

          // 감면권 목록 텍스트 생성
          const reductionListText = reductions
            .map((r, i) => {
              const reducedFee = r.reductionPercent >= 100
                ? BigInt(0)
                : (expectedFee * BigInt(100 - r.reductionPercent)) / BigInt(100);
              const savedFee = expectedFee - reducedFee;
              const effectText = r.reductionPercent >= 100
                ? '100% 면제'
                : `${r.reductionPercent}% 감면 (${savedFee.toLocaleString()} 절약)`;
              return `**${i + 1}. ${r.itemName}** - ${effectText} (보유: ${r.quantity}개)`;
            })
            .join('\n');

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
                `기본 수수료: **${expectedFee.toLocaleString()} ${currencyName}**\n\n` +
                `**보유 감면권:**\n${reductionListText}\n\n` +
                `사용할 감면권을 선택하세요.`
              )
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('-# 30초 내에 선택해주세요')
            );

          // 감면권 선택 메뉴 생성
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_reduction')
            .setPlaceholder('사용할 감면권을 선택하세요')
            .addOptions(
              reductions.map((r) => {
                const reducedFee = r.reductionPercent >= 100
                  ? BigInt(0)
                  : (expectedFee * BigInt(100 - r.reductionPercent)) / BigInt(100);
                const effectText = r.reductionPercent >= 100
                  ? '100% 면제'
                  : `${r.reductionPercent}% 감면, 수수료 ${reducedFee.toLocaleString()}`;
                return {
                  label: r.itemName,
                  description: effectText,
                  value: `${r.userItemId}:${r.reductionPercent}`,
                };
              })
            );

          const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

          const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('skip_reduction')
                .setLabel(`감면권 사용 안함 (수수료 ${expectedFee.toLocaleString()} ${currencyName})`)
                .setStyle(ButtonStyle.Secondary),
            );

          const response = await interaction.editReply({
            components: [confirmContainer.toJSON(), selectRow, buttonRow],
            flags: MessageFlags.IsComponentsV2,
          });

          try {
            const componentInteraction = await response.awaitMessageComponent({
              filter: (i) => i.user.id === senderId,
              time: 30_000,
            });

            if (componentInteraction.isStringSelectMenu() && componentInteraction.customId === 'select_reduction') {
              // 감면권 선택됨
              const [userItemIdStr, percentStr] = componentInteraction.values[0]!.split(':');
              const selectedUserItemId = BigInt(userItemIdStr!);
              const selectedPercent = parseInt(percentStr!, 10);

              await container.shopV2Service.useTransferFeeReduction(guildId, senderId, selectedUserItemId);
              reductionPercent = selectedPercent;
              usedReductionItem = true;
            }
            // skip_reduction 버튼은 그냥 진행

            await componentInteraction.deferUpdate();
          } catch {
            // 시간 초과 - 이체 취소
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
            // 5분 후 자동 삭제
            setTimeout(() => {
              interaction.deleteReply().catch(() => {});
            }, 300000);
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
        // 5분 후 자동 삭제
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 300000);
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

      // 수수료가 발생했으면 은행 패널 새로고침 (국고 잔액 업데이트)
      if (hasFee && !usedReductionItem) {
        refreshBankPanel(interaction.client, guildId, container).catch(() => {});
      }

      // 명령어 실행 채널에는 ephemeral로 응답
      await interaction.editReply({
        components: [successContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });

      // 5분 후 자동 삭제
      setTimeout(() => {
        interaction.deleteReply().catch(() => {});
      }, 300000);

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
      // 5분 후 자동 삭제
      setTimeout(() => {
        interaction.deleteReply().catch(() => {});
      }, 300000);
    }
  },
};
