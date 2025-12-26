import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { Command } from './types';
import type { AvailableTicket } from '@topia/core';

/** 인벤토리 Embed 생성 */
function createInventoryEmbed(
  tickets: AvailableTicket[],
  topyName: string,
  rubyName: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎒 인벤토리')
    .setTimestamp();

  if (tickets.length === 0) {
    embed.setDescription('사용 가능한 선택권이 없습니다.\n상점에서 티켓을 구매해보세요!');
    return embed;
  }

  embed.setDescription('아래 메뉴에서 사용할 선택권을 선택하세요.');

  const fields = tickets.map((t, idx) => {
    const currencyName = t.shopItem.currencyType === 'topy' ? topyName : rubyName;
    const isPeriod = t.ticket.consumeQuantity === 0;

    let info = `📦 보유: **${t.userItem.quantity}개**`;
    if (isPeriod) {
      info += '\n♾️ 기간제 (무제한 변경)';
    } else {
      info += `\n🔄 사용 시 ${t.ticket.consumeQuantity}개 소모`;
    }

    if (t.userItem.expiresAt) {
      const expiresAt = new Date(t.userItem.expiresAt);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      info += `\n⏰ ${daysLeft}일 남음`;
    }

    if (t.ticket.removePreviousRole) {
      info += '\n🔁 이전 역할 자동 제거';
    }

    if (t.ticket.description) {
      info += `\n> ${t.ticket.description}`;
    }

    const roleCount = t.ticket.roleOptions?.length ?? 0;
    info += `\n🎭 ${roleCount}개 역할 선택 가능`;

    return {
      name: `${idx + 1}. ${t.ticket.name}`,
      value: info,
      inline: true,
    };
  });

  embed.addFields(fields);

  return embed;
}

/** 선택권 선택 메뉴 생성 */
function createTicketSelectMenu(
  tickets: AvailableTicket[],
  customId: string
): StringSelectMenuBuilder {
  const options = tickets.slice(0, 25).map((t) => {
    const isPeriod = t.ticket.consumeQuantity === 0;
    const expiresInfo = t.userItem.expiresAt
      ? ` (${Math.ceil((new Date(t.userItem.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}일)`
      : '';

    return {
      label: t.ticket.name,
      description: isPeriod
        ? `기간제${expiresInfo}`
        : `보유: ${t.userItem.quantity}개 / 소모: ${t.ticket.consumeQuantity}개`,
      value: t.ticket.id.toString(),
      emoji: '🎫',
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('사용할 선택권을 선택하세요')
    .addOptions(options);
}

export const inventoryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('인벤토리')
    .setDescription('보유한 선택권을 확인하고 역할로 교환합니다'),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // 화폐 설정 조회
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
      const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

      // 사용 가능한 선택권 조회
      const ticketsResult = await container.inventoryService.getAvailableTickets(guildId, userId);
      if (!ticketsResult.success) {
        await interaction.editReply({
          content: '인벤토리 정보를 불러오는 중 오류가 발생했습니다.',
        });
        return;
      }

      const tickets = ticketsResult.data;

      // 인벤토리가 비어있는 경우
      if (tickets.length === 0) {
        const embed = createInventoryEmbed(tickets, topyName, rubyName);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // 인벤토리 Embed 생성
      const embed = createInventoryEmbed(tickets, topyName, rubyName);

      // 선택권 선택 메뉴 생성
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        createTicketSelectMenu(tickets, `inventory_select_${userId}`)
      );

      const response = await interaction.editReply({
        embeds: [embed],
        components: [selectRow],
      });

      // 선택권 선택 이벤트 처리
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === userId && i.customId === `inventory_select_${userId}`,
        time: 60000,
      });

      collector.on('collect', async (selectInteraction) => {
        const selectedValue = selectInteraction.values[0];
        if (!selectedValue) {
          await selectInteraction.reply({
            content: '선택권을 선택해주세요.',
            ephemeral: true,
          });
          return;
        }

        const ticketId = parseInt(selectedValue, 10);
        const selectedTicket = tickets.find((t) => t.ticket.id === ticketId);

        if (!selectedTicket) {
          await selectInteraction.reply({
            content: '선택권을 찾을 수 없습니다.',
            ephemeral: true,
          });
          return;
        }

        // 역할 옵션 조회
        const ticketWithOptions = await container.inventoryService.getTicketRoleOptions(ticketId);
        if (!ticketWithOptions.success || !ticketWithOptions.data) {
          await selectInteraction.reply({
            content: '선택권 정보를 불러오는 중 오류가 발생했습니다.',
            ephemeral: true,
          });
          return;
        }

        const roleOptions = ticketWithOptions.data.roleOptions ?? [];
        if (roleOptions.length === 0) {
          await selectInteraction.reply({
            content: '이 선택권에 등록된 역할이 없습니다. 관리자에게 문의하세요.',
            ephemeral: true,
          });
          return;
        }

        // 역할 선택 드롭다운 생성
        const roleSelectMenu = new StringSelectMenuBuilder()
          .setCustomId(`inventory_role_select_${ticketId}_${userId}`)
          .setPlaceholder('원하는 역할을 선택하세요')
          .addOptions(
            roleOptions.map((opt) => ({
              label: opt.name,
              description: opt.description || undefined,
              value: opt.id.toString(),
              emoji: '🎭',
            }))
          );

        const roleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelectMenu);

        const isPeriod = selectedTicket.ticket.consumeQuantity === 0;
        const roleEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`🎫 ${selectedTicket.ticket.name}`)
          .setDescription('원하는 역할을 선택하세요.')
          .addFields(
            {
              name: '📦 보유 수량',
              value: `${selectedTicket.userItem.quantity}개`,
              inline: true,
            },
            {
              name: isPeriod ? '♾️ 기간제' : '🔄 소모 개수',
              value: isPeriod ? '무제한 변경 가능' : `${selectedTicket.ticket.consumeQuantity}개`,
              inline: true,
            }
          );

        if (selectedTicket.ticket.removePreviousRole) {
          roleEmbed.addFields({
            name: '🔁 이전 역할',
            value: '자동으로 제거됩니다',
            inline: true,
          });
        }

        roleEmbed.addFields({
          name: '🎭 선택 가능한 역할',
          value: roleOptions.map((opt) => `• ${opt.name}`).join('\n'),
        });

        await selectInteraction.reply({
          embeds: [roleEmbed],
          components: [roleSelectRow],
          ephemeral: true,
        });

        // 역할 선택 대기
        try {
          const roleSelectInteraction = await selectInteraction.channel?.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === userId && i.customId === `inventory_role_select_${ticketId}_${userId}`,
            time: 30000,
          });

          if (!roleSelectInteraction) return;

          const selectedRoleOptionId = parseInt(roleSelectInteraction.values[0] ?? '', 10);
          const selectedRoleOption = roleOptions.find((opt) => opt.id === selectedRoleOptionId);

          if (!selectedRoleOption) {
            await roleSelectInteraction.update({
              embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 오류').setDescription('역할을 찾을 수 없습니다.')],
              components: [],
            });
            return;
          }

          // 확인 버튼 표시
          const confirmEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ 역할 교환 확인')
            .setDescription(`**${selectedRoleOption.name}** 역할로 교환하시겠습니까?`)
            .addFields(
              { name: '선택권', value: selectedTicket.ticket.name, inline: true },
              { name: '선택한 역할', value: selectedRoleOption.name, inline: true }
            );

          if (!isPeriod) {
            confirmEmbed.addFields({
              name: '소모',
              value: `${selectedTicket.ticket.consumeQuantity}개 → 남은 수량: ${selectedTicket.userItem.quantity - selectedTicket.ticket.consumeQuantity}개`,
              inline: false,
            });
          }

          if (selectedTicket.ticket.removePreviousRole) {
            confirmEmbed.addFields({
              name: '⚠️ 주의',
              value: '이 선택권의 다른 역할이 있다면 제거됩니다.',
              inline: false,
            });
          }

          const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`inventory_confirm_${ticketId}_${selectedRoleOptionId}_${userId}`)
              .setLabel('교환하기')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
            new ButtonBuilder()
              .setCustomId(`inventory_cancel_${userId}`)
              .setLabel('취소')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('❌')
          );

          await roleSelectInteraction.update({
            embeds: [confirmEmbed],
            components: [confirmRow],
          });

          // 확인 버튼 대기
          const buttonInteraction = await selectInteraction.channel?.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (i) =>
              i.user.id === userId &&
              (i.customId === `inventory_confirm_${ticketId}_${selectedRoleOptionId}_${userId}` ||
                i.customId === `inventory_cancel_${userId}`),
            time: 30000,
          });

          if (!buttonInteraction) return;

          if (buttonInteraction.customId === `inventory_cancel_${userId}`) {
            await buttonInteraction.update({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x808080)
                  .setTitle('❌ 교환 취소')
                  .setDescription('역할 교환이 취소되었습니다.'),
              ],
              components: [],
            });
            return;
          }

          // 역할 교환 처리
          await buttonInteraction.deferUpdate();

          const exchangeResult = await container.inventoryService.exchangeRole(
            guildId,
            userId,
            ticketId,
            selectedRoleOptionId
          );

          if (!exchangeResult.success) {
            let errorMessage = '역할 교환 중 오류가 발생했습니다.';

            switch (exchangeResult.error.type) {
              case 'TICKET_NOT_FOUND':
                errorMessage = '선택권을 찾을 수 없습니다.';
                break;
              case 'ROLE_OPTION_NOT_FOUND':
                errorMessage = '역할 옵션을 찾을 수 없습니다.';
                break;
              case 'ITEM_NOT_OWNED':
                errorMessage = '이 선택권을 보유하고 있지 않습니다.';
                break;
              case 'ITEM_EXPIRED':
                errorMessage = '선택권의 유효기간이 만료되었습니다.';
                break;
              case 'INSUFFICIENT_QUANTITY':
                errorMessage = `수량이 부족합니다. (필요: ${exchangeResult.error.required}개, 보유: ${exchangeResult.error.available}개)`;
                break;
            }

            await buttonInteraction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFF0000)
                  .setTitle('❌ 교환 실패')
                  .setDescription(errorMessage),
              ],
              components: [],
            });
            return;
          }

          const result = exchangeResult.data;

          // Discord 역할 부여/제거
          try {
            const member = await interaction.guild?.members.fetch(userId);
            if (member) {
              // 이전 역할 제거
              for (const roleId of result.removedRoleIds) {
                try {
                  const role = await interaction.guild?.roles.fetch(roleId);
                  if (role && member.roles.cache.has(roleId)) {
                    await member.roles.remove(role);
                  }
                } catch (err) {
                  console.error(`역할 제거 실패 (${roleId}):`, err);
                }
              }

              // 새 역할 부여
              const newRole = await interaction.guild?.roles.fetch(result.newRoleId);
              if (newRole) {
                await member.roles.add(newRole);
              }
            }
          } catch (err) {
            console.error('역할 부여/제거 오류:', err);
          }

          // 성공 메시지
          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ 역할 교환 완료!')
            .setDescription(`**${selectedRoleOption.name}** 역할이 부여되었습니다!`)
            .addFields(
              { name: '🎭 새 역할', value: `<@&${result.newRoleId}>`, inline: true }
            );

          if (result.removedRoleIds.length > 0) {
            successEmbed.addFields({
              name: '🔁 제거된 역할',
              value: result.removedRoleIds.map((id) => `<@&${id}>`).join(', '),
              inline: true,
            });
          }

          if (!result.isPeriod) {
            successEmbed.addFields({
              name: '📦 남은 수량',
              value: `${result.remainingQuantity}개`,
              inline: true,
            });
          }

          if (result.expiresAt) {
            const daysLeft = Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            successEmbed.addFields({
              name: '⏰ 유효기간',
              value: `${daysLeft}일 남음`,
              inline: true,
            });
          }

          successEmbed.setTimestamp();

          await buttonInteraction.editReply({
            embeds: [successEmbed],
            components: [],
          });

        } catch {
          // 시간 초과
          await selectInteraction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('⏰ 시간 초과')
                .setDescription('역할 선택 시간이 초과되었습니다.'),
            ],
            components: [],
          });
        }
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({
            components: [],
          });
        } catch {
          // 메시지가 이미 삭제된 경우 무시
        }
      });

    } catch (error) {
      console.error('인벤토리 명령어 오류:', error);
      await interaction.editReply({
        content: '인벤토리 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },
};
