import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  type APIContainerComponent,
} from 'discord.js';
import type { Command } from './types';
import type { AvailableTicket, TicketRoleOption, OwnedItem, ShopItemType } from '@topia/core';

// Components v2 플래그 (1 << 15)
const IS_COMPONENTS_V2 = 32768;

/** 아이템 타입별 라벨 */
const ITEM_TYPE_LABELS: Record<ShopItemType, string> = {
  custom: '🎁 일반',
  warning_reduction: '⚠️ 경고차감',
  tax_exemption: '💸 세금면제',
  transfer_fee_reduction: '💳 수수료감면',
  activity_boost: '🚀 활동부스트',
  premium_afk: '💤 프리미엄잠수',
  vip_lounge: '👑 VIP라운지',
  color_basic: '🎨 색상선택(기본)',
  color_premium: '🌈 색상선택(프리미엄)',
  role_ticket: '🎭 역할선택권',
  vault_subscription: '🔐 금고이용권',
};

/** 인벤토리 Container 생성 (Components v2) - 모든 보유 아이템 */
function createInventoryContainer(
  items: OwnedItem[],
  topyName: string,
  rubyName: string,
  autoAppliedRoles?: { itemName: string; roleId: string }[]
): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🎒 인벤토리')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 자동 적용된 역할이 있으면 알림 표시
  if (autoAppliedRoles && autoAppliedRoles.length > 0) {
    const roleList = autoAppliedRoles
      .map(r => `• **${r.itemName}** → <@&${r.roleId}>`)
      .join('\n');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✨ **기존 구매 아이템의 역할이 자동으로 적용되었습니다!**\n${roleList}`
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
  }

  if (items.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('보유한 아이템이 없습니다.\n상점에서 아이템을 구매해보세요!')
    );
    return container.toJSON();
  }

  // 선택권과 일반 아이템 분류
  const ticketItems = items.filter(i => i.isTicket);
  const otherItems = items.filter(i => !i.isTicket);

  // 선택권이 있으면 안내 메시지 표시
  if (ticketItems.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🎫 **선택권**은 아래 메뉴에서 역할로 교환할 수 있습니다.')
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
  }

  // 모든 아이템 표시
  items.forEach((item, idx) => {
    const isPeriod = item.shopItem.durationDays > 0;
    const typeLabel = ITEM_TYPE_LABELS[item.shopItem.itemType] || '🎁 일반';

    let info = `**${idx + 1}. ${item.shopItem.name}**\n`;
    info += `${typeLabel}`;

    // 수량 표시 (기간제는 수량 대신 남은 기간)
    if (isPeriod && item.userItem.expiresAt) {
      const expiresAt = new Date(item.userItem.expiresAt);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      info += ` · ⏰ ${daysLeft}일 남음`;
    } else {
      info += ` · 📦 **${item.userItem.quantity}개**`;
    }

    // 선택권인 경우 추가 정보
    if (item.isTicket && item.ticket) {
      const roleCount = item.ticket.roleOptions?.length ?? 0;
      info += ` · 🎭 ${roleCount}개 역할`;
    }

    if (item.shopItem.description) {
      info += `\n> ${item.shopItem.description}`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(info)
    );
  });

  return container.toJSON();
}

/** 인벤토리 Container 생성 (선택권용) - 역할 교환 시 사용 */
function createTicketInventoryContainer(
  tickets: AvailableTicket[],
  topyName: string,
  rubyName: string
): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🎫 선택권')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (tickets.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('사용 가능한 선택권이 없습니다.')
    );
    return container.toJSON();
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('아래 메뉴에서 사용할 선택권을 선택하세요.')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  tickets.forEach((t, idx) => {
    const isPeriod = t.ticket.consumeQuantity === 0;

    let info = `**${idx + 1}. ${t.ticket.name}**\n`;
    info += `📦 보유: **${t.userItem.quantity}개**`;

    if (isPeriod) {
      info += ' · ♾️ 기간제';
    } else {
      info += ` · 🔄 ${t.ticket.consumeQuantity}개 소모`;
    }

    if (t.userItem.expiresAt) {
      const expiresAt = new Date(t.userItem.expiresAt);
      const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      info += ` · ⏰ ${daysLeft}일`;
    }

    if (t.ticket.removePreviousRole) {
      info += ' · 🔁 자동제거';
    }

    const roleCount = t.ticket.roleOptions?.length ?? 0;
    info += `\n🎭 ${roleCount}개 역할 선택 가능`;

    if (t.ticket.description) {
      info += `\n> ${t.ticket.description}`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(info)
    );
  });

  return container.toJSON();
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

/** 역할 선택 Container 생성 (Components v2) */
function createRoleSelectContainer(
  ticket: AvailableTicket,
  roleOptions: TicketRoleOption[]
): APIContainerComponent {
  const isPeriod = ticket.ticket.consumeQuantity === 0;
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# 🎫 ${ticket.ticket.name}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('원하는 역할을 선택하세요.')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `📦 **보유 수량**: ${ticket.userItem.quantity}개\n`;
  infoText += isPeriod ? '♾️ **기간제**: 무제한 변경 가능' : `🔄 **소모 개수**: ${ticket.ticket.consumeQuantity}개`;

  if (ticket.ticket.removePreviousRole) {
    infoText += '\n🔁 **이전 역할**: 자동으로 제거됩니다';
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**🎭 선택 가능한 역할**\n${roleOptions.map((opt) => `• ${opt.name}`).join('\n')}`
    )
  );

  return container.toJSON();
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

/** 확인 화면 Container 생성 (Components v2) */
function createConfirmContainer(
  ticket: AvailableTicket,
  roleOption: TicketRoleOption
): APIContainerComponent {
  const isPeriod = ticket.ticket.consumeQuantity === 0;
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# ✅ 역할 교환 확인')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${roleOption.name}** 역할로 교환하시겠습니까?`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `**선택권**: ${ticket.ticket.name}\n`;
  infoText += `**선택한 역할**: ${roleOption.name}`;

  if (!isPeriod) {
    infoText += `\n\n**소모**: ${ticket.ticket.consumeQuantity}개 → 남은 수량: ${ticket.userItem.quantity - ticket.ticket.consumeQuantity}개`;
  }

  if (ticket.ticket.removePreviousRole) {
    infoText += '\n\n⚠️ **주의**: 이 선택권의 다른 역할이 있다면 제거됩니다.';
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  return container.toJSON();
}

/** 간단한 메시지 Container 생성 */
function createMessageContainer(title: string, description: string): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(description)
  );

  return container.toJSON();
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
    .setDescription('보유한 아이템을 확인하고 선택권은 역할로 교환합니다'),

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

      // 모든 보유 아이템 조회
      const ownedItemsResult = await container.inventoryService.getOwnedItems(guildId, userId);
      if (!ownedItemsResult.success) {
        await interaction.editReply({
          content: '인벤토리 정보를 불러오는 중 오류가 발생했습니다.',
        });
        return;
      }

      const ownedItems = ownedItemsResult.data;

      // fixedRoleId가 설정되어 있지만 아직 적용되지 않은 아이템 자동 적용
      const autoAppliedRoles: { itemName: string; roleId: string }[] = [];
      for (const ownedItem of ownedItems) {
        console.log(`[Inventory] Checking item: ${ownedItem.shopItem.name}, isTicket: ${ownedItem.isTicket}, ticket: ${JSON.stringify(ownedItem.ticket)}, userItem.fixedRoleId: ${ownedItem.userItem.fixedRoleId}`);

        // 이미 fixed_role_id가 적용되어 있으면 스킵
        if (ownedItem.userItem.fixedRoleId) {
          console.log(`[Inventory] Skipping ${ownedItem.shopItem.name}: already has fixedRoleId`);
          continue;
        }

        // 선택권 아이템이고 fixedRoleId가 있는지 확인
        if (ownedItem.isTicket && ownedItem.ticket?.fixedRoleId) {
          console.log(`[Inventory] Auto-applying fixedRoleId for ${ownedItem.shopItem.name}`);
          const activateResult = await container.shopV2Service.activateFixedRole(
            guildId,
            userId,
            ownedItem.shopItem.id,
            ownedItem.userItem.id
          );

          if (activateResult.success && activateResult.data) {
            // Discord 역할 부여
            try {
              const member = await interaction.guild?.members.fetch(userId);
              if (member) {
                // cache.get 대신 fetch 사용 (캐시에 없을 수 있음)
                const role = await interaction.guild?.roles.fetch(activateResult.data.fixedRoleId);
                if (role && !member.roles.cache.has(activateResult.data.fixedRoleId)) {
                  await member.roles.add(role);
                  autoAppliedRoles.push({
                    itemName: ownedItem.shopItem.name,
                    roleId: activateResult.data.fixedRoleId,
                  });
                  console.log(`[Inventory] Auto-applied fixed role ${activateResult.data.fixedRoleId} for item ${ownedItem.shopItem.name}`);
                }
              }
            } catch (roleError) {
              console.error('[Inventory] Auto role grant failed:', roleError);
            }
          }
        }
      }

      // 사용 가능한 선택권 조회 (역할 교환용)
      const ticketsResult = await container.inventoryService.getAvailableTickets(guildId, userId);
      const tickets = ticketsResult.success ? ticketsResult.data : [];

      // 인벤토리가 비어있는 경우
      if (ownedItems.length === 0) {
        await interaction.editReply({
          components: [createInventoryContainer(ownedItems, topyName, rubyName)],
          flags: IS_COMPONENTS_V2,
        });
        // 5분 후 자동 삭제
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 300000);
        return;
      }

      // 상태 관리
      type State =
        | { type: 'ticket_select' }
        | { type: 'role_select'; ticketId: number; roleOptions: TicketRoleOption[] }
        | { type: 'confirm'; ticketId: number; roleOptionId: number; roleOptions: TicketRoleOption[] }
        | { type: 'done' };

      let state: State = { type: 'ticket_select' };

      // 초기 화면 렌더링 (Components v2) - 모든 아이템 + 선택권 선택 메뉴
      const renderTicketSelect = (showAutoApplied = false) => {
        const inventoryContainer = createInventoryContainer(
          ownedItems,
          topyName,
          rubyName,
          showAutoApplied ? autoAppliedRoles : undefined
        );

        // 선택권이 있으면 선택 메뉴 표시
        if (tickets.length > 0) {
          const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            createTicketSelectMenu(tickets, `inv_ticket_${userId}`)
          );
          return { components: [inventoryContainer, selectRow.toJSON()], flags: IS_COMPONENTS_V2 };
        }

        return { components: [inventoryContainer], flags: IS_COMPONENTS_V2 };
      };

      const renderRoleSelect = (ticketId: number, roleOptions: TicketRoleOption[]) => {
        const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
        const roleSelectContainer = createRoleSelectContainer(ticket, roleOptions);
        const roleSelectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createRoleSelectMenu(roleOptions, ticketId, userId)
        );
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          createBackButton(userId)
        );
        return { components: [roleSelectContainer, roleSelectRow.toJSON(), backRow.toJSON()], flags: IS_COMPONENTS_V2 };
      };

      const renderConfirm = (ticketId: number, roleOptionId: number, roleOptions: TicketRoleOption[]) => {
        const ticket = tickets.find((t) => t.ticket.id === ticketId)!;
        const roleOption = roleOptions.find((opt) => opt.id === roleOptionId)!;
        const confirmContainer = createConfirmContainer(ticket, roleOption);
        const buttonRow = createConfirmButtons(ticketId, roleOptionId, userId);
        return { components: [confirmContainer, buttonRow.toJSON()], flags: IS_COMPONENTS_V2 };
      };

      // 초기 렌더링
      const response = await interaction.editReply(renderTicketSelect(true));

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
                components: [createMessageContainer('❌ 교환 실패', errorMessage)],
                flags: IS_COMPONENTS_V2,
              });
              state = { type: 'done' };
              collector.stop();
              return;
            }

            const result = exchangeResult.data;

            // 디버그 로그
            console.log('[INVENTORY] Exchange result:', {
              newRoleId: result.newRoleId,
              fixedRoleId: result.fixedRoleId,
              removedRoleIds: result.removedRoleIds,
            });

            // Discord 역할 부여/제거
            const actuallyRemovedRoleIds: string[] = [];
            try {
              const member = await interaction.guild?.members.fetch(userId);
              if (member) {
                // 이전 역할 제거 (실제로 가지고 있는 역할만)
                for (const roleId of result.removedRoleIds) {
                  try {
                    if (member.roles.cache.has(roleId)) {
                      const role = await interaction.guild?.roles.fetch(roleId);
                      if (role) {
                        await member.roles.remove(role);
                        actuallyRemovedRoleIds.push(roleId);
                      }
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

            // 성공 메시지 Container 생성
            const successContainer = new ContainerBuilder();

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# ✅ 역할 교환 완료!')
            );

            successContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`**${roleOption.name}** 역할이 부여되었습니다!`)
            );

            successContainer.addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            let infoText = `🎭 **교환 역할**: <@&${result.newRoleId}>`;

            // 고정 역할 표시
            if (result.fixedRoleId) {
              infoText += `\n🔒 **고정 역할**: <@&${result.fixedRoleId}>`;
            }

            if (actuallyRemovedRoleIds.length > 0) {
              infoText += `\n🔁 **제거된 역할**: ${actuallyRemovedRoleIds.map((id) => `<@&${id}>`).join(', ')}`;
            }

            if (!result.isPeriod) {
              infoText += `\n📦 **남은 수량**: ${result.remainingQuantity}개`;
            }

            if (result.expiresAt) {
              const daysLeft = Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              infoText += `\n📦 **아이템 유효기간**: ${daysLeft}일 남음`;
            }

            // 역할 효과 만료 시각 표시
            if (result.roleExpiresAt) {
              const roleExpireTimestamp = Math.floor(new Date(result.roleExpiresAt).getTime() / 1000);
              infoText += `\n⏰ **역할 효과 만료**: <t:${roleExpireTimestamp}:R> (<t:${roleExpireTimestamp}:F>)`;
            }

            successContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(infoText)
            );

            await i.editReply({
              components: [successContainer.toJSON()],
              flags: IS_COMPONENTS_V2,
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
              components: [createMessageContainer('⏰ 시간 초과', '인벤토리 사용 시간이 초과되었습니다.')],
              flags: IS_COMPONENTS_V2,
            });
          } catch {
            // 무시
          }
        }
        // 5분 후 자동 삭제
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 300000);
      });

    } catch (error) {
      console.error('인벤토리 명령어 오류:', error);
      await interaction.editReply({
        content: '인벤토리 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },
};
