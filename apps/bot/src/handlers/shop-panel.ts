import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  SeparatorSpacingSize,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type APIContainerComponent,
} from 'discord.js';
import type { ShopItemV2, ShopService, CurrencyService, CurrencyType } from '@topia/core';
import { getItemPrice } from '@topia/core';

const ITEMS_PER_PAGE = 5;

// Components v2 플래그 (1 << 15)
const IS_COMPONENTS_V2 = 32768;

interface Container {
  shopV2Service: ShopService;
  currencyService: CurrencyService;
}

/** 상점 아이템을 Components v2 Container로 변환 */
function createShopContainer(
  items: ShopItemV2[],
  currentMode: CurrencyType,
  currencyName: string,
  topyBalance: bigint,
  rubyBalance: bigint,
  topyName: string,
  rubyName: string,
  page: number = 0,
  itemsPerPage: number = ITEMS_PER_PAGE
): APIContainerComponent {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const pageItems = items.slice(startIdx, startIdx + itemsPerPage);

  const emoji = currentMode === 'topy' ? '💰' : '💎';

  const container = new ContainerBuilder();

  // 헤더
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${emoji} ${currencyName} 상점`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 설명
  if (items.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${currencyName}로 구매할 수 있는 아이템입니다.\n아래 메뉴에서 구매할 아이템을 선택하세요.`)
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('현재 판매 중인 아이템이 없습니다.')
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 아이템 목록
  if (pageItems.length > 0) {
    pageItems.forEach((item, idx) => {
      const price = getItemPrice(item, currentMode) ?? BigInt(0);

      let info = `**${startIdx + idx + 1}. ${item.name}**\n`;
      info += `💰 **${price.toLocaleString()}** ${currencyName}`;

      if (item.durationDays > 0) {
        info += ` · ⏰ ${item.durationDays}일`;
      } else {
        info += ' · ♾️ 영구';
      }

      if (item.stock !== null) {
        info += ` · 📦 ${item.stock}개`;
      }
      if (item.maxPerUser !== null) {
        info += ` · 👤 ${item.maxPerUser}회`;
      }

      if (item.description) {
        info += `\n> ${item.description}`;
      }

      container.addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(info)
        )
      );
    });
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 잔액 정보
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**💳 보유 잔액**\n💰 ${topyBalance.toLocaleString()} ${topyName}  |  💎 ${rubyBalance.toLocaleString()} ${rubyName}`
    )
  );

  // 페이지 정보
  if (totalPages > 1) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# 페이지 ${page + 1}/${totalPages}`)
    );
  }

  return container.toJSON();
}

/** 상점 아이템을 Embed 형식으로 변환 (fallback) */
function createShopEmbed(
  items: ShopItemV2[],
  currentMode: CurrencyType,
  currencyName: string,
  topyBalance: bigint,
  rubyBalance: bigint,
  topyName: string,
  rubyName: string,
  page: number = 0,
  itemsPerPage: number = ITEMS_PER_PAGE
): EmbedBuilder {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const pageItems = items.slice(startIdx, startIdx + itemsPerPage);

  const color = currentMode === 'topy' ? 0xFFD700 : 0xE91E63;
  const emoji = currentMode === 'topy' ? '💰' : '💎';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji} ${currencyName} 상점`)
    .setDescription(
      items.length > 0
        ? `${currencyName}로 구매할 수 있는 아이템입니다.\n아래 메뉴에서 구매할 아이템을 선택하세요.`
        : '현재 판매 중인 아이템이 없습니다.'
    )
    .setTimestamp();

  if (pageItems.length > 0) {
    const fields = pageItems.map((item, idx) => {
      const price = getItemPrice(item, currentMode) ?? BigInt(0);

      let info = `💰 **${price.toLocaleString()}** ${currencyName}`;

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

  // 잔액 정보 추가
  embed.addFields({
    name: '💳 보유 잔액',
    value: `💰 ${topyBalance.toLocaleString()} ${topyName}  |  💎 ${rubyBalance.toLocaleString()} ${rubyName}`,
    inline: false,
  });

  if (totalPages > 1) {
    embed.setFooter({ text: `페이지 ${page + 1}/${totalPages}` });
  }

  return embed;
}

/** 모드 전환 버튼 생성 */
function createModeButtons(
  currentMode: CurrencyType,
  userId: string,
  topyName: string,
  rubyName: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_mode_topy_${userId}`)
      .setLabel(`💰 ${topyName} 상점`)
      .setStyle(currentMode === 'topy' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`shop_mode_ruby_${userId}`)
      .setLabel(`💎 ${rubyName} 상점`)
      .setStyle(currentMode === 'ruby' ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );
}

/** 아이템 선택 메뉴 생성 */
function createSelectMenu(
  items: ShopItemV2[],
  currencyName: string,
  customId: string,
  currencyType: CurrencyType
): StringSelectMenuBuilder {
  const options = items.slice(0, 25).map((item) => {
    const price = getItemPrice(item, currencyType) ?? BigInt(0);
    const durationInfo = item.durationDays > 0 ? ` (${item.durationDays}일)` : ' (영구)';

    return {
      label: item.name,
      description: `${price.toLocaleString()} ${currencyName}${durationInfo}`,
      value: item.id.toString(),
      emoji: '🎫',
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('구매할 아이템을 선택하세요')
    .addOptions(options);
}

/** 상점 패널 버튼 핸들러 */
export async function handleShopPanelButton(
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
    // 화폐 설정 조회
    const settingsResult = await container.currencyService.getSettings(guildId);
    const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';
    const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

    // 잔액 조회
    const walletsResult = await container.currencyService.getWallets(guildId, userId);
    let topyBalance = BigInt(0);
    let rubyBalance = BigInt(0);
    if (walletsResult.success && walletsResult.data) {
      topyBalance = walletsResult.data.topy?.balance ?? BigInt(0);
      rubyBalance = walletsResult.data.ruby?.balance ?? BigInt(0);
    }

    // 초기 모드: 토피
    let currentMode: CurrencyType = 'topy';
    let currentPage = 0;

    // 모드별 아이템 조회
    const fetchItems = async (mode: CurrencyType) => {
      const result = await container.shopV2Service.getEnabledShopItemsByCurrency(guildId, mode);
      return result.success ? result.data : [];
    };

    let items = await fetchItems(currentMode);

    // 잔액 새로고침 함수
    const refreshBalances = async () => {
      const result = await container.currencyService.getWallets(guildId, userId);
      if (result.success && result.data) {
        topyBalance = result.data.topy?.balance ?? BigInt(0);
        rubyBalance = result.data.ruby?.balance ?? BigInt(0);
      }
    };

    const getCurrencyName = () => currentMode === 'topy' ? topyName : rubyName;

    const getComponents = () => {
      const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
      const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

      // Row 1: 모드 전환 버튼
      components.push(createModeButtons(currentMode, userId, topyName, rubyName));

      // Row 2: 아이템 선택 메뉴 (아이템이 있을 경우)
      if (items.length > 0) {
        components.push(
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            createSelectMenu(items, getCurrencyName(), `shop_panel_select_${userId}`, currentMode)
          )
        );
      }

      // Row 3: 페이지네이션 버튼 (여러 페이지일 경우)
      if (totalPages > 1) {
        components.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`shop_panel_prev_${userId}`)
              .setLabel('◀ 이전')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage === 0),
            new ButtonBuilder()
              .setCustomId(`shop_panel_next_${userId}`)
              .setLabel('다음 ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
              .setCustomId(`shop_panel_refresh_${userId}`)
              .setLabel('🔄 새로고침')
              .setStyle(ButtonStyle.Secondary)
          )
        );
      }

      return components;
    };

    // 상점 Container 생성 (Components v2)
    const shopContainer = createShopContainer(
      items,
      currentMode,
      getCurrencyName(),
      topyBalance,
      rubyBalance,
      topyName,
      rubyName,
      currentPage
    );

    const response = await interaction.editReply({
      components: [shopContainer, ...getComponents()],
      flags: IS_COMPONENTS_V2,
    });

    // Collector로 상호작용 처리
    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === userId,
      time: 300000, // 5분
    });

    collector.on('collect', async (componentInteraction) => {
      // 모드 전환: 토피
      if (componentInteraction.customId === `shop_mode_topy_${userId}`) {
        if (currentMode === 'topy') {
          await componentInteraction.deferUpdate();
          return;
        }
        currentMode = 'topy';
        currentPage = 0;
        items = await fetchItems(currentMode);
        await refreshBalances();

        await componentInteraction.update({
          components: [createShopContainer(items, currentMode, getCurrencyName(), topyBalance, rubyBalance, topyName, rubyName, currentPage), ...getComponents()],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 모드 전환: 루비
      if (componentInteraction.customId === `shop_mode_ruby_${userId}`) {
        if (currentMode === 'ruby') {
          await componentInteraction.deferUpdate();
          return;
        }
        currentMode = 'ruby';
        currentPage = 0;
        items = await fetchItems(currentMode);
        await refreshBalances();

        await componentInteraction.update({
          components: [createShopContainer(items, currentMode, getCurrencyName(), topyBalance, rubyBalance, topyName, rubyName, currentPage), ...getComponents()],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 페이지네이션: 이전
      if (componentInteraction.customId === `shop_panel_prev_${userId}`) {
        currentPage = Math.max(0, currentPage - 1);
        await componentInteraction.update({
          components: [createShopContainer(items, currentMode, getCurrencyName(), topyBalance, rubyBalance, topyName, rubyName, currentPage), ...getComponents()],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 페이지네이션: 다음
      if (componentInteraction.customId === `shop_panel_next_${userId}`) {
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        await componentInteraction.update({
          components: [createShopContainer(items, currentMode, getCurrencyName(), topyBalance, rubyBalance, topyName, rubyName, currentPage), ...getComponents()],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 새로고침
      if (componentInteraction.customId === `shop_panel_refresh_${userId}`) {
        items = await fetchItems(currentMode);
        await refreshBalances();
        await componentInteraction.update({
          components: [createShopContainer(items, currentMode, getCurrencyName(), topyBalance, rubyBalance, topyName, rubyName, currentPage), ...getComponents()],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 아이템 선택
      if (componentInteraction.customId === `shop_panel_select_${userId}` && componentInteraction.isStringSelectMenu()) {
        await handleItemSelection(componentInteraction, container, items, currentMode, topyName, rubyName, topyBalance, rubyBalance);
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
    console.error('상점 패널 오류:', error);
    await interaction.editReply({
      content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
    });
    setTimeout(async () => {
      try { await interaction.deleteReply(); } catch { /* 이미 삭제됨 */ }
    }, 5000);
  }
}

const AUTO_DELETE_DELAY = 3000; // 3초 후 자동 삭제

/** 간단한 메시지 Container 생성 (Components v2) */
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

/** 일정 시간 후 메시지 삭제 */
function scheduleMessageDelete(interaction: StringSelectMenuInteraction, delay: number = AUTO_DELETE_DELAY) {
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch {
      // 이미 삭제됨
    }
  }, delay);
}

/** 수량 선택 UI 생성 (Components v2) */
function createQuantitySelectContainer(
  item: ShopItemV2,
  currencyName: string,
  currencyType: CurrencyType,
  currentQuantity: number
): APIContainerComponent {
  const price = getItemPrice(item, currencyType) ?? BigInt(0);
  const totalPrice = price * BigInt(currentQuantity);

  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🔢 수량 선택')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${item.name}**을(를) 몇 개 구매하시겠습니까?`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `💰 **개당 가격**: ${price.toLocaleString()} ${currencyName}\n`;
  infoText += `📦 **선택 수량**: ${currentQuantity}개\n`;
  infoText += `💵 **총 가격**: ${totalPrice.toLocaleString()} ${currencyName}`;

  if (item.stock !== null) {
    infoText += `\n📦 **남은 재고**: ${item.stock}개`;
  }
  if (item.maxPerUser !== null) {
    infoText += `\n👤 **인당 제한**: ${item.maxPerUser}개`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  return container.toJSON();
}

/** 수량 선택 UI 생성 (Embed fallback) */
function createQuantitySelectEmbed(
  item: ShopItemV2,
  currencyName: string,
  currencyType: CurrencyType,
  currentQuantity: number
): EmbedBuilder {
  const price = getItemPrice(item, currencyType) ?? BigInt(0);
  const totalPrice = price * BigInt(currentQuantity);
  const color = currencyType === 'topy' ? 0xFFD700 : 0xE91E63;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🔢 수량 선택')
    .setDescription(`**${item.name}**을(를) 몇 개 구매하시겠습니까?`)
    .addFields(
      { name: '💰 개당 가격', value: `${price.toLocaleString()} ${currencyName}`, inline: true },
      { name: '📦 선택 수량', value: `${currentQuantity}개`, inline: true },
      { name: '💵 총 가격', value: `${totalPrice.toLocaleString()} ${currencyName}`, inline: true }
    );

  if (item.stock !== null) {
    embed.addFields({ name: '📦 남은 재고', value: `${item.stock}개`, inline: true });
  }
  if (item.maxPerUser !== null) {
    embed.addFields({ name: '👤 인당 제한', value: `${item.maxPerUser}개`, inline: true });
  }

  return embed;
}

/** 수량 선택 버튼 생성 */
function createQuantityButtons(
  itemId: number,
  userId: string,
  currentQuantity: number,
  maxQuantity: number
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // 수량 조절 버튼
  const adjustRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_qty_1_${itemId}_${userId}`)
      .setLabel('1개')
      .setStyle(currentQuantity === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`shop_qty_5_${itemId}_${userId}`)
      .setLabel('5개')
      .setStyle(currentQuantity === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(maxQuantity < 5),
    new ButtonBuilder()
      .setCustomId(`shop_qty_10_${itemId}_${userId}`)
      .setLabel('10개')
      .setStyle(currentQuantity === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(maxQuantity < 10),
    new ButtonBuilder()
      .setCustomId(`shop_qty_custom_${itemId}_${userId}`)
      .setLabel('직접 입력')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );
  rows.push(adjustRow);

  // 확인/취소 버튼
  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_qty_confirm_${itemId}_${currentQuantity}_${userId}`)
      .setLabel(`${currentQuantity}개 구매하기`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`shop_qty_cancel_${userId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌')
  );
  rows.push(confirmRow);

  return rows;
}

/** 최대 구매 가능 수량 계산 */
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

/** 아이템 선택 처리 */
async function handleItemSelection(
  interaction: StringSelectMenuInteraction,
  container: Container,
  items: ShopItemV2[],
  currencyType: CurrencyType,
  topyName: string,
  rubyName: string,
  topyBalance: bigint,
  rubyBalance: bigint
) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const itemId = parseInt(interaction.values[0]!, 10);

  const selectedItem = items.find((item) => item.id === itemId);
  const currencyName = currencyType === 'topy' ? topyName : rubyName;

  if (!selectedItem) {
    await interaction.update({
      components: [createMessageContainer('❌ 오류', '아이템을 찾을 수 없습니다.')],
      flags: IS_COMPONENTS_V2,
    });
    scheduleMessageDelete(interaction);
    return;
  }

  // 현재 보유 수량 조회 (인당 제한 확인용)
  const userItemResult = await container.shopV2Service.getUserItem(guildId, userId, itemId);
  const currentOwned = userItemResult.success && userItemResult.data ? userItemResult.data.quantity : 0;
  const maxQuantity = calculateMaxQuantity(selectedItem, currentOwned);

  if (maxQuantity <= 0) {
    await interaction.update({
      components: [createMessageContainer('❌ 구매 불가', selectedItem.stock === 0 ? '재고가 소진되었습니다.' : '구매 한도에 도달했습니다.')],
      flags: IS_COMPONENTS_V2,
    });
    scheduleMessageDelete(interaction, 3000);
    return;
  }

  let currentQuantity = 1;

  // 수량 선택 화면 표시 (Components v2)
  await interaction.update({
    components: [createQuantitySelectContainer(selectedItem, currencyName, currencyType, currentQuantity), ...createQuantityButtons(itemId, userId, currentQuantity, maxQuantity)],
    flags: IS_COMPONENTS_V2,
  });

  // 수량 선택 및 구매 확인 처리
  try {
    const collector = interaction.message.createMessageComponentCollector({
      filter: (i) => i.user.id === userId,
      time: 60000, // 1분
    });

    collector.on('collect', async (componentInteraction) => {
      const customId = componentInteraction.customId;

      // 취소
      if (customId === `shop_qty_cancel_${userId}`) {
        collector.stop('cancelled');
        await componentInteraction.update({
          components: [createMessageContainer('❌ 구매 취소', '구매가 취소되었습니다.')],
          flags: IS_COMPONENTS_V2,
        });
        scheduleMessageDelete(interaction);
        return;
      }

      // 수량 선택 (1, 5, 10)
      if (customId.startsWith(`shop_qty_`) && !customId.includes('confirm') && !customId.includes('custom') && !customId.includes('cancel')) {
        const qty = parseInt(customId.split('_')[2]!, 10);
        currentQuantity = Math.min(qty, maxQuantity);
        await componentInteraction.update({
          components: [createQuantitySelectContainer(selectedItem, currencyName, currencyType, currentQuantity), ...createQuantityButtons(itemId, userId, currentQuantity, maxQuantity)],
          flags: IS_COMPONENTS_V2,
        });
        return;
      }

      // 직접 입력
      if (customId === `shop_qty_custom_${itemId}_${userId}`) {
        const modal = new ModalBuilder()
          .setCustomId(`shop_qty_modal_${itemId}_${userId}`)
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
            filter: (i) => i.customId === `shop_qty_modal_${itemId}_${userId}`,
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
            components: [createQuantitySelectContainer(selectedItem, currencyName, currencyType, currentQuantity), ...createQuantityButtons(itemId, userId, currentQuantity, maxQuantity)],
            flags: IS_COMPONENTS_V2,
          });
        } catch {
          // 모달 시간 초과
        }
        return;
      }

      // 구매 확인
      if (customId.startsWith(`shop_qty_confirm_${itemId}_`)) {
        const parts = customId.split('_');
        const confirmQty = parseInt(parts[4]!, 10);
        collector.stop('confirmed');

        await componentInteraction.deferUpdate();

        // 구매 처리 (currencyType 전달)
        const purchaseResult = await container.shopV2Service.purchaseItem(
          guildId,
          userId,
          itemId,
          confirmQty,
          currencyType
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
              errorMessage = `잔액이 부족합니다.\n필요: ${required.toLocaleString()} ${currencyName}\n보유: ${available.toLocaleString()} ${currencyName}`;
              break;
            case 'INVALID_QUANTITY':
              errorMessage = '잘못된 수량입니다. (1~99개)';
              break;
          }

          await componentInteraction.editReply({
            components: [createMessageContainer('❌ 구매 실패', errorMessage)],
            flags: IS_COMPONENTS_V2,
          });
          scheduleMessageDelete(interaction, 5000);
          return;
        }

        const { item, userItem, totalCost: paidAmount } = purchaseResult.data;

        // 성공 메시지 Container 생성
        const successContainer = new ContainerBuilder();

        successContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ✅ 구매 완료!')
        );

        successContainer.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        successContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${item.name}** x${confirmQty}개를 구매했습니다!`)
        );

        successContainer.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        let infoText = `💰 **지불 금액**: ${paidAmount.toLocaleString()} ${currencyName}\n`;
        infoText += `📦 **보유 수량**: ${userItem.quantity}개`;

        if (userItem.expiresAt) {
          const expiresAt = new Date(userItem.expiresAt);
          const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          infoText += `\n⏰ **유효기간**: ${daysLeft}일 남음`;
        }

        successContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(infoText)
        );

        successContainer.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        successContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('💡 **사용 방법**: `/인벤토리` 명령어에서 역할로 교환할 수 있습니다.')
        );

        await componentInteraction.editReply({
          components: [successContainer.toJSON()],
          flags: IS_COMPONENTS_V2,
        });
        scheduleMessageDelete(interaction, 5000);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await interaction.editReply({
            components: [createMessageContainer('⏰ 시간 초과', '구매 시간이 초과되었습니다.')],
            flags: IS_COMPONENTS_V2,
          });
          scheduleMessageDelete(interaction, 3000);
        } catch {
          // 이미 삭제됨
        }
      }
    });
  } catch {
    // 초기 collector 오류
    await interaction.editReply({
      components: [createMessageContainer('⏰ 시간 초과', '구매 시간이 초과되었습니다.')],
      flags: IS_COMPONENTS_V2,
    });
    scheduleMessageDelete(interaction, 3000);
  }
}
