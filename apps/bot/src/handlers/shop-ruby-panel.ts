import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { ShopItemV2, ShopService, CurrencyService, ShopPanelService } from '@topia/core';

const ITEMS_PER_PAGE = 5;
const CURRENCY_TYPE = 'ruby' as const;

interface Container {
  shopV2Service: ShopService;
  currencyService: CurrencyService;
  shopPanelService: ShopPanelService;
}

/** 상점 아이템을 Embed 형식으로 변환 */
function createShopEmbed(
  items: ShopItemV2[],
  rubyName: string,
  page: number = 0,
  itemsPerPage: number = ITEMS_PER_PAGE
): EmbedBuilder {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const pageItems = items.slice(startIdx, startIdx + itemsPerPage);

  const embed = new EmbedBuilder()
    .setColor(0xE91E63) // 분홍색 (루비)
    .setTitle(`💎 ${rubyName} 상점`)
    .setDescription(
      items.length > 0
        ? `${rubyName}로 구매할 수 있는 아이템입니다.\n아래 메뉴에서 구매할 아이템을 선택하세요.`
        : '현재 판매 중인 아이템이 없습니다.'
    )
    .setTimestamp();

  if (pageItems.length > 0) {
    const fields = pageItems.map((item, idx) => {
      let info = `💎 **${item.price.toLocaleString()}** ${rubyName}`;

      if (item.durationDays > 0) {
        info += `\n⏰ ${item.durationDays}일 유효`;
      } else {
        info += '\n♾️ 영구';
      }

      if (item.stock !== null) {
        info += `\n📦 재고: ${item.stock}개`;
      }
      if (item.maxPerUser !== null) {
        info += `\n👤 인당 ${item.maxPerUser}회`;
      }
      if (item.description) {
        info += `\n> ${item.description}`;
      }

      return {
        name: `${startIdx + idx + 1}. ${item.name}`,
        value: info,
        inline: true,
      };
    });

    embed.addFields(fields);
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `페이지 ${page + 1}/${totalPages}` });
  }

  return embed;
}

/** 아이템 선택 메뉴 생성 */
function createSelectMenu(
  items: ShopItemV2[],
  rubyName: string,
  customId: string
): StringSelectMenuBuilder {
  const options = items.slice(0, 25).map((item) => {
    const durationInfo = item.durationDays > 0 ? ` (${item.durationDays}일)` : ' (영구)';

    return {
      label: item.name,
      description: `${item.price.toLocaleString()} ${rubyName}${durationInfo}`,
      value: item.id.toString(),
      emoji: '🎫',
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('구매할 아이템을 선택하세요')
    .addOptions(options);
}

/** 루비 상점 패널 버튼 핸들러 */
export async function handleRubyShopPanelButton(
  interaction: ButtonInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // 루비 상점 아이템만 조회
    const itemsResult = await container.shopV2Service.getEnabledShopItemsByCurrency(guildId, CURRENCY_TYPE);
    if (!itemsResult.success) {
      await interaction.editReply({
        content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
      });
      setTimeout(async () => {
        try { await interaction.deleteReply(); } catch { /* 이미 삭제됨 */ }
      }, 5000);
      return;
    }

    const items = itemsResult.data;

    // 화폐 설정 조회
    const settingsResult = await container.currencyService.getSettings(guildId);
    const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

    // 상점이 비어있는 경우
    if (items.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xE91E63)
        .setTitle(`💎 ${rubyName} 상점`)
        .setDescription(`현재 판매 중인 ${rubyName} 아이템이 없습니다.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch {
          // 이미 삭제됨
        }
      }, 5000);
      return;
    }

    let currentPage = 0;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    const getComponents = () => {
      const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

      // 아이템 선택 메뉴
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createSelectMenu(items, rubyName, `shop_ruby_panel_select_${userId}`)
        )
      );

      // 페이지네이션 버튼 (여러 페이지일 경우)
      if (totalPages > 1) {
        components.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`shop_ruby_panel_prev_${userId}`)
              .setLabel('◀ 이전')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId(`shop_ruby_panel_next_${userId}`)
              .setLabel('다음 ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
              .setCustomId(`shop_ruby_panel_refresh_${userId}`)
              .setLabel('🔄 새로고침')
              .setStyle(ButtonStyle.Primary)
          )
        );
      }

      return components;
    };

    // 상점 Embed 생성
    const embed = createShopEmbed(items, rubyName, currentPage);

    const response = await interaction.editReply({
      embeds: [embed],
      components: getComponents(),
    });

    // Collector로 상호작용 처리
    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === userId,
      time: 300000, // 5분
    });

    collector.on('collect', async (componentInteraction) => {
      // 페이지네이션
      if (componentInteraction.customId === `shop_ruby_panel_prev_${userId}`) {
        currentPage = Math.max(0, currentPage - 1);
        await componentInteraction.update({
          embeds: [createShopEmbed(items, rubyName, currentPage)],
          components: getComponents(),
        });
        return;
      }

      if (componentInteraction.customId === `shop_ruby_panel_next_${userId}`) {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        await componentInteraction.update({
          embeds: [createShopEmbed(items, rubyName, currentPage)],
          components: getComponents(),
        });
        return;
      }

      if (componentInteraction.customId === `shop_ruby_panel_refresh_${userId}`) {
        // 아이템 다시 조회
        const refreshResult = await container.shopV2Service.getEnabledShopItemsByCurrency(guildId, CURRENCY_TYPE);
        if (refreshResult.success) {
          items.length = 0;
          items.push(...refreshResult.data);
        }
        await componentInteraction.update({
          embeds: [createShopEmbed(items, rubyName, currentPage)],
          components: getComponents(),
        });
        return;
      }

      // 아이템 선택
      if (componentInteraction.customId === `shop_ruby_panel_select_${userId}` && componentInteraction.isStringSelectMenu()) {
        await handleItemSelection(componentInteraction, container, items, rubyName);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await interaction.deleteReply();
        } catch {
          // 이미 삭제됨
        }
      }
    });
  } catch (error) {
    console.error('루비 상점 패널 오류:', error);
    await interaction.editReply({
      content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
    });
    setTimeout(async () => {
      try { await interaction.deleteReply(); } catch { /* 이미 삭제됨 */ }
    }, 5000);
  }
}

const AUTO_DELETE_DELAY = 3000;

function scheduleMessageDelete(interaction: StringSelectMenuInteraction, delay: number = AUTO_DELETE_DELAY) {
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch {
      // 이미 삭제됨
    }
  }, delay);
}

function createQuantitySelectEmbed(
  item: ShopItemV2,
  rubyName: string,
  currentQuantity: number
): EmbedBuilder {
  const totalPrice = item.price * BigInt(currentQuantity);

  const embed = new EmbedBuilder()
    .setColor(0xE91E63)
    .setTitle('🔢 수량 선택')
    .setDescription(`**${item.name}**을(를) 몇 개 구매하시겠습니까?`)
    .addFields(
      { name: '💎 개당 가격', value: `${item.price.toLocaleString()} ${rubyName}`, inline: true },
      { name: '📦 선택 수량', value: `${currentQuantity}개`, inline: true },
      { name: '💵 총 가격', value: `${totalPrice.toLocaleString()} ${rubyName}`, inline: true }
    );

  if (item.stock !== null) {
    embed.addFields({ name: '📦 남은 재고', value: `${item.stock}개`, inline: true });
  }
  if (item.maxPerUser !== null) {
    embed.addFields({ name: '👤 인당 제한', value: `${item.maxPerUser}개`, inline: true });
  }

  return embed;
}

function createQuantityButtons(
  itemId: number,
  userId: string,
  currentQuantity: number,
  maxQuantity: number
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const adjustRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_ruby_qty_1_${itemId}_${userId}`)
      .setLabel('1개')
      .setStyle(currentQuantity === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`shop_ruby_qty_5_${itemId}_${userId}`)
      .setLabel('5개')
      .setStyle(currentQuantity === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(maxQuantity < 5),
    new ButtonBuilder()
      .setCustomId(`shop_ruby_qty_10_${itemId}_${userId}`)
      .setLabel('10개')
      .setStyle(currentQuantity === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(maxQuantity < 10),
    new ButtonBuilder()
      .setCustomId(`shop_ruby_qty_custom_${itemId}_${userId}`)
      .setLabel('직접 입력')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );
  rows.push(adjustRow);

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_ruby_qty_confirm_${itemId}_${currentQuantity}_${userId}`)
      .setLabel(`${currentQuantity}개 구매하기`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`shop_ruby_qty_cancel_${userId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌')
  );
  rows.push(confirmRow);

  return rows;
}

function calculateMaxQuantity(item: ShopItemV2, currentOwned: number): number {
  let max = 99;

  if (item.stock !== null) {
    max = Math.min(max, item.stock);
  }
  if (item.maxPerUser !== null) {
    max = Math.min(max, item.maxPerUser - currentOwned);
  }

  return Math.max(0, max);
}

async function handleItemSelection(
  interaction: StringSelectMenuInteraction,
  container: Container,
  items: ShopItemV2[],
  rubyName: string
) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const itemId = parseInt(interaction.values[0]!, 10);

  const selectedItem = items.find((item) => item.id === itemId);

  if (!selectedItem) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 오류')
          .setDescription('아이템을 찾을 수 없습니다.'),
      ],
      components: [],
    });
    scheduleMessageDelete(interaction);
    return;
  }

  const userItemResult = await container.shopV2Service.getUserItem(guildId, userId, itemId);
  const currentOwned = userItemResult.success && userItemResult.data ? userItemResult.data.quantity : 0;
  const maxQuantity = calculateMaxQuantity(selectedItem, currentOwned);

  if (maxQuantity <= 0) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 구매 불가')
          .setDescription(selectedItem.stock === 0 ? '재고가 소진되었습니다.' : '구매 한도에 도달했습니다.'),
      ],
      components: [],
    });
    scheduleMessageDelete(interaction, 3000);
    return;
  }

  let currentQuantity = 1;

  await interaction.update({
    embeds: [createQuantitySelectEmbed(selectedItem, rubyName, currentQuantity)],
    components: createQuantityButtons(itemId, userId, currentQuantity, maxQuantity),
  });

  try {
    const collector = interaction.message.createMessageComponentCollector({
      filter: (i) => i.user.id === userId,
      time: 60000,
    });

    collector.on('collect', async (componentInteraction) => {
      const customId = componentInteraction.customId;

      if (customId === `shop_ruby_qty_cancel_${userId}`) {
        collector.stop('cancelled');
        await componentInteraction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0x808080)
              .setTitle('❌ 구매 취소')
              .setDescription('구매가 취소되었습니다.'),
          ],
          components: [],
        });
        scheduleMessageDelete(interaction);
        return;
      }

      if (customId.startsWith(`shop_ruby_qty_`) && !customId.includes('confirm') && !customId.includes('custom') && !customId.includes('cancel')) {
        const qty = parseInt(customId.split('_')[3]!, 10);
        currentQuantity = Math.min(qty, maxQuantity);
        await componentInteraction.update({
          embeds: [createQuantitySelectEmbed(selectedItem, rubyName, currentQuantity)],
          components: createQuantityButtons(itemId, userId, currentQuantity, maxQuantity),
        });
        return;
      }

      if (customId === `shop_ruby_qty_custom_${itemId}_${userId}`) {
        const modal = new ModalBuilder()
          .setCustomId(`shop_ruby_qty_modal_${itemId}_${userId}`)
          .setTitle('수량 입력')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('quantity')
                .setLabel(`구매할 수량 (최대 ${maxQuantity}개)`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('1')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(2)
            )
          );

        await componentInteraction.showModal(modal);

        try {
          const modalInteraction = await componentInteraction.awaitModalSubmit({
            filter: (i) => i.customId === `shop_ruby_qty_modal_${itemId}_${userId}`,
            time: 30000,
          });

          const inputQty = parseInt(modalInteraction.fields.getTextInputValue('quantity'), 10);
          if (isNaN(inputQty) || inputQty < 1) {
            await modalInteraction.reply({ content: '올바른 숫자를 입력해주세요.', ephemeral: true });
            return;
          }

          currentQuantity = Math.min(inputQty, maxQuantity);
          await modalInteraction.deferUpdate();
          await interaction.editReply({
            embeds: [createQuantitySelectEmbed(selectedItem, rubyName, currentQuantity)],
            components: createQuantityButtons(itemId, userId, currentQuantity, maxQuantity),
          });
        } catch {
          // 모달 시간 초과
        }
        return;
      }

      if (customId.startsWith(`shop_ruby_qty_confirm_${itemId}_`)) {
        const parts = customId.split('_');
        const confirmQty = parseInt(parts[5]!, 10);
        collector.stop('confirmed');

        await componentInteraction.deferUpdate();

        const purchaseResult = await container.shopV2Service.purchaseItem(
          guildId,
          userId,
          itemId,
          confirmQty
        );

        if (!purchaseResult.success) {
          let errorMessage = '구매 처리 중 오류가 발생했습니다.';

          switch (purchaseResult.error.type) {
            case 'ITEM_NOT_FOUND':
              errorMessage = '아이템을 찾을 수 없습니다.';
              break;
            case 'ITEM_DISABLED':
              errorMessage = '현재 판매 중지된 아이템입니다.';
              break;
            case 'OUT_OF_STOCK':
              if ('available' in purchaseResult.error && 'requested' in purchaseResult.error) {
                errorMessage = `재고가 부족합니다. (요청: ${purchaseResult.error.requested}개, 재고: ${purchaseResult.error.available}개)`;
              } else {
                errorMessage = '재고가 소진되었습니다.';
              }
              break;
            case 'PURCHASE_LIMIT_EXCEEDED':
              if ('requested' in purchaseResult.error) {
                errorMessage = `구매 한도를 초과합니다. (최대 ${purchaseResult.error.maxPerUser}회, 현재 ${purchaseResult.error.currentCount}회 구매함, 요청 ${purchaseResult.error.requested}개)`;
              } else {
                errorMessage = `구매 한도를 초과했습니다. (최대 ${purchaseResult.error.maxPerUser}회)`;
              }
              break;
            case 'INSUFFICIENT_BALANCE':
              const required = purchaseResult.error.required;
              const available = purchaseResult.error.available;
              errorMessage = `잔액이 부족합니다.\n필요: ${required.toLocaleString()} ${rubyName}\n보유: ${available.toLocaleString()} ${rubyName}`;
              break;
            case 'INVALID_QUANTITY':
              errorMessage = '잘못된 수량입니다. (1~99개)';
              break;
          }

          await componentInteraction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ 구매 실패')
                .setDescription(errorMessage),
            ],
            components: [],
          });
          scheduleMessageDelete(interaction, 5000);
          return;
        }

        const { item, userItem, totalCost: paidAmount } = purchaseResult.data;

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ 구매 완료!')
          .setDescription(`**${item.name}** x${confirmQty}개를 구매했습니다!`)
          .addFields(
            { name: '💎 지불 금액', value: `${paidAmount.toLocaleString()} ${rubyName}`, inline: true },
            { name: '📦 보유 수량', value: `${userItem.quantity}개`, inline: true }
          );

        if (userItem.expiresAt) {
          const expiresAt = new Date(userItem.expiresAt);
          const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          successEmbed.addFields({
            name: '⏰ 유효기간',
            value: `${daysLeft}일 남음`,
            inline: true,
          });
        }

        successEmbed.addFields({
          name: '💡 사용 방법',
          value: '`/인벤토리` 명령어에서 역할로 교환할 수 있습니다.',
          inline: false,
        });

        successEmbed.setTimestamp();

        await componentInteraction.editReply({
          embeds: [successEmbed],
          components: [],
        });
        scheduleMessageDelete(interaction, 5000);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('⏰ 시간 초과')
                .setDescription('구매 시간이 초과되었습니다.'),
            ],
            components: [],
          });
          scheduleMessageDelete(interaction, 3000);
        } catch {
          // 이미 삭제됨
        }
      }
    });
  } catch {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('⏰ 시간 초과')
          .setDescription('구매 시간이 초과되었습니다.'),
      ],
      components: [],
    });
    scheduleMessageDelete(interaction, 3000);
  }
}
