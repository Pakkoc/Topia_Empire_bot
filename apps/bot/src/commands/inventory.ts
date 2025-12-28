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
import type { AvailableTicket, TicketRoleOption } from '@topia/core';

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

/** 역할 선택 Embed 생성 */
function createRoleSelectEmbed(
  ticket: AvailableTicket,
  roleOptions: TicketRoleOption[]
): EmbedBuilder {
  const isPeriod = ticket.ticket.consumeQuantity === 0;
  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle(`🎫 ${ticket.ticket.name}`)
    .setDescription('원하는 역할을 선택하세요.')
    .addFields(
      {
        name: '📦 보유 수량',
        value: `${ticket.userItem.quantity}개`,
        inline: true,
      },
      {
        name: isPeriod ? '♾️ 기간제' : '🔄 소모 개수',
        value: isPeriod ? '무제한 변경 가능' : `${ticket.ticket.consumeQuantity}개`,
        inline: true,
      }
    );

  if (ticket.ticket.removePreviousRole) {
    embed.addFields({
      name: '🔁 이전 역할',
      value: '자동으로 제거됩니다',
      inline: true,
    });
  }

  embed.addFields({
    name: '🎭 선택 가능한 역할',
    value: roleOptions.map((opt) => `• ${opt.name}`).join('\n'),
  });

  return embed;
}

/** 역할 선택 메뉴 생성 */
function createRoleSelectMenu(
  roleOptions: TicketRoleOption[],
  ticketId: number,
  userId: string
): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(`inv_role_${ticketId}_${userId}`)
    .setPlaceholder('원하는 역할을 선택하세요')
    .addOptions(
      roleOptions.map((opt) => ({
        label: opt.name,
        description: opt.description || undefined,
        value: opt.id.toString(),
        emoji: '🎭',
      }))
    );
}

/** 뒤로가기 버튼 생성 */
function createBackButton(userId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`inv_back_${userId}`)
    .setLabel('뒤로가기')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️');
}

/** 확인 Embed 생성 */
function createConfirmEmbed(
  ticket: AvailableTicket,
  roleOption: TicketRoleOption
): EmbedBuilder {
  const isPeriod = ticket.ticket.consumeQuantity === 0;
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ 역할 교환 확인')
    .setDescription(`**${roleOption.name}** 역할로 교환하시겠습니까?`)
    .addFields(
      { name: '선택권', value: ticket.ticket.name, inline: true },
      { name: '선택한 역할', value: roleOption.name, inline: true }
    );

  if (!isPeriod) {
    embed.addFields({
      name: '소모',
      value: `${ticket.ticket.consumeQuantity}개 → 남은 수량: ${ticket.userItem.quantity - ticket.ticket.consumeQuantity}개`,
      inline: false,
    });
  }

  if (ticket.ticket.removePreviousRole) {
    embed.addFields({
      name: '⚠️ 주의',
      value: '이 선택권의 다른 역할이 있다면 제거됩니다.',
      inline: false,
    });
  }

  return embed;
}

/** 확인/취소 버튼 생성 */
function createConfirmButtons(
  ticketId: number,
  roleOptionId: number,
  userId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_confirm_${ticketId}_${roleOptionId}_${userId}`)
      .setLabel('교환하기')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`inv_back_${userId}`)
      .setLabel('뒤로가기')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );
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

      // 상태 관리
      type State =
        | { type: 'ticket_select' }
        | { type: 'role_select'; ticketId: number; roleOptions: TicketRoleOption[] }
        | { type: 'confirm'; ticketId: number; roleOptionId: number; roleOptions: TicketRoleOption[] }
        | { type: 'done' };

      let state: State = { type: 'ticket_select' };

      // 초기 화면 렌더링
      const renderTicketSelect = () => {
        const embed = createInventoryEmbed(tickets, topyName, rubyName);
        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createTicketSelectMenu(tickets, `inv_ticket_${userId}`)
        );
        return { embeds: [embed], components: [selectRow] };
      };

      const renderRoleSelect = (ticketId: number, roleOptions: TicketRoleOption[]) => {
        const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
        const embed = createRoleSelectEmbed(ticket, roleOptions);
        const roleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createRoleSelectMenu(roleOptions, ticketId, userId)
        );
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          createBackButton(userId)
        );
        return { embeds: [embed], components: [roleSelectRow, backRow] };
      };

      const renderConfirm = (ticketId: number, roleOptionId: number, roleOptions: TicketRoleOption[]) => {
        const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
        const roleOption = roleOptions.find((opt) => opt.id === roleOptionId)!;
        const embed = createConfirmEmbed(ticket, roleOption);
        const buttonRow = createConfirmButtons(ticketId, roleOptionId, userId);
        return { embeds: [embed], components: [buttonRow] };
      };

      // 초기 렌더링
      const response = await interaction.editReply(renderTicketSelect());

      // 통합 컬렉터
      const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 120000, // 2분
      });

      collector.on('collect', async (i) => {
        try {
          // 선택권 선택
          if (i.isStringSelectMenu() && i.customId === `inv_ticket_${userId}`) {
            const ticketId = parseInt(i.values[0] ?? '', 10);
            const ticket = tickets.find((t) => t.ticket.id === ticketId);

            if (!ticket) {
              await i.reply({ content: '선택권을 찾을 수 없습니다.', ephemeral: true });
              return;
            }

            // 역할 옵션 조회
            const ticketWithOptions = await container.inventoryService.getTicketRoleOptions(ticketId);
            if (!ticketWithOptions.success || !ticketWithOptions.data) {
              await i.reply({ content: '선택권 정보를 불러오는 중 오류가 발생했습니다.', ephemeral: true });
              return;
            }

            const roleOptions = ticketWithOptions.data.roleOptions ?? [];
            if (roleOptions.length === 0) {
              await i.reply({ content: '이 선택권에 등록된 역할이 없습니다.', ephemeral: true });
              return;
            }

            state = { type: 'role_select', ticketId, roleOptions };
            await i.update(renderRoleSelect(ticketId, roleOptions));
          }

          // 역할 선택
          else if (i.isStringSelectMenu() && i.customId.startsWith(`inv_role_`)) {
            if (state.type !== 'role_select') return;

            const roleOptionId = parseInt(i.values[0] ?? '', 10);
            const roleOption = state.roleOptions.find((opt) => opt.id === roleOptionId);

            if (!roleOption) {
              await i.reply({ content: '역할을 찾을 수 없습니다.', ephemeral: true });
              return;
            }

            state = { type: 'confirm', ticketId: state.ticketId, roleOptionId, roleOptions: state.roleOptions };
            await i.update(renderConfirm(state.ticketId, roleOptionId, state.roleOptions));
          }

          // 뒤로가기 버튼
          else if (i.isButton() && i.customId === `inv_back_${userId}`) {
            if (state.type === 'role_select') {
              state = { type: 'ticket_select' };
              await i.update(renderTicketSelect());
            } else if (state.type === 'confirm') {
              state = { type: 'role_select', ticketId: state.ticketId, roleOptions: state.roleOptions };
              await i.update(renderRoleSelect(state.ticketId, state.roleOptions));
            }
          }

          // 확인 버튼
          else if (i.isButton() && i.customId.startsWith(`inv_confirm_`)) {
            if (state.type !== 'confirm') return;

            await i.deferUpdate();

            const { ticketId, roleOptionId, roleOptions } = state;
            const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
            const roleOption = roleOptions.find((opt) => opt.id === roleOptionId)!;

            // 역할 교환 처리
            const exchangeResult = await container.inventoryService.exchangeRole(
              guildId,
              userId,
              ticketId,
              roleOptionId
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

              await i.editReply({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ 교환 실패')
                    .setDescription(errorMessage),
                ],
                components: [],
              });
              state = { type: 'done' };
              collector.stop();
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

                // 고정 역할 부여 (있는 경우)
                if (result.fixedRoleId) {
                  try {
                    const fixedRole = await interaction.guild?.roles.fetch(result.fixedRoleId);
                    if (fixedRole && !member.roles.cache.has(result.fixedRoleId)) {
                      await member.roles.add(fixedRole);
                    }
                  } catch (err) {
                    console.error(`고정 역할 부여 실패 (${result.fixedRoleId}):`, err);
                  }
                }

                // 새 역할 부여 (교환 가능 역할)
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
              .setDescription(`**${roleOption.name}** 역할이 부여되었습니다!`)
              .addFields(
                { name: '🎭 교환 역할', value: `<@&${result.newRoleId}>`, inline: true }
              );

            // 고정 역할 표시
            if (result.fixedRoleId) {
              successEmbed.addFields({
                name: '🔒 고정 역할',
                value: `<@&${result.fixedRoleId}>`,
                inline: true,
              });
            }

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
                name: '📦 아이템 유효기간',
                value: `${daysLeft}일 남음`,
                inline: true,
              });
            }

            // 역할 효과 만료 시각 표시
            if (result.roleExpiresAt) {
              const roleExpireTimestamp = Math.floor(new Date(result.roleExpiresAt).getTime() / 1000);
              successEmbed.addFields({
                name: '⏰ 역할 효과 만료',
                value: `<t:${roleExpireTimestamp}:R> (<t:${roleExpireTimestamp}:F>)`,
                inline: false,
              });
            }

            successEmbed.setTimestamp();

            await i.editReply({
              embeds: [successEmbed],
              components: [],
            });

            state = { type: 'done' };
            collector.stop();
          }
        } catch (error) {
          console.error('인벤토리 상호작용 오류:', error);
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'time' && state.type !== 'done') {
          try {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x808080)
                  .setTitle('⏰ 시간 초과')
                  .setDescription('인벤토리 사용 시간이 초과되었습니다.'),
              ],
              components: [],
            });
          } catch {
            // 무시
          }
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
