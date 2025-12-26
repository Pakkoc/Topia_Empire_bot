import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { ShopItemV2, ShopService, CurrencyService } from '@topia/core';

const ITEMS_PER_PAGE = 5;

interface Container {
  shopV2Service: ShopService;
  currencyService: CurrencyService;
}

/** 상점 아이템을 Embed 형식으로 변환 */
function createShopEmbed(
  items: ShopItemV2[],
  topyName: string,
  rubyName: string,
  page: number = 0,
  itemsPerPage: number = ITEMS_PER_PAGE
): EmbedBuilder {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const pageItems = items.slice(startIdx, startIdx + itemsPerPage);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛒 상점')
    .setDescription(
      items.length > 0
        ? '아래 메뉴에서 구매할 아이템을 선택하세요.\n구매한 아이템은 `/인벤토리` 명령어에서 사용할 수 있습니다.'
        : '현재 판매 중인 아이템이 없습니다.'
    )
    .setTimestamp();

  if (pageItems.length > 0) {
    const fields = pageItems.map((item, idx) => {
      const currencyName = item.currencyType === 'topy' ? topyName : rubyName;

      let info = `💰 **${item.price.toLocaleString()}** ${currencyName}`;

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
  topyName: string,
  rubyName: string,
  customId: string
): StringSelectMenuBuilder {
  const options = items.slice(0, 25).map((item) => {
    const currencyName = item.currencyType === 'topy' ? topyName : rubyName;
    const durationInfo = item.durationDays > 0 ? ` (${item.durationDays}일)` : ' (영구)';

    return {
      label: item.name,
      description: `${item.price.toLocaleString()} ${currencyName}${durationInfo}`,
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
    // 상점 아이템 조회 (V2 시스템 사용)
    const itemsResult = await container.shopV2Service.getEnabledShopItems(guildId);
    if (!itemsResult.success) {
      await interaction.editReply({
        content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
      });
      return;
    }

    const items = itemsResult.data;

    // 화폐 설정 조회
    const settingsResult = await container.currencyService.getSettings(guildId);
    const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';
    const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

    // 상점이 비어있는 경우
    if (items.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛒 상점')
        .setDescription('현재 판매 중인 아이템이 없습니다.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let currentPage = 0;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    const getComponents = () => {
      const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

      // 아이템 선택 메뉴
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createSelectMenu(items, topyName, rubyName, `shop_panel_select_${userId}`)
        )
      );

      // 페이지네이션 버튼 (여러 페이지일 경우)
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
              .setStyle(ButtonStyle.Primary)
          )
        );
      }

      return components;
    };

    // 상점 Embed 생성
    const embed = createShopEmbed(items, topyName, rubyName, currentPage);

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
      if (componentInteraction.customId === `shop_panel_prev_${userId}`) {
        currentPage = Math.max(0, currentPage - 1);
        await componentInteraction.update({
          embeds: [createShopEmbed(items, topyName, rubyName, currentPage)],
          components: getComponents(),
        });
        return;
      }

      if (componentInteraction.customId === `shop_panel_next_${userId}`) {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        await componentInteraction.update({
          embeds: [createShopEmbed(items, topyName, rubyName, currentPage)],
          components: getComponents(),
        });
        return;
      }

      if (componentInteraction.customId === `shop_panel_refresh_${userId}`) {
        // 아이템 다시 조회
        const refreshResult = await container.shopV2Service.getEnabledShopItems(guildId);
        if (refreshResult.success) {
          items.length = 0;
          items.push(...refreshResult.data);
        }
        await componentInteraction.update({
          embeds: [createShopEmbed(items, topyName, rubyName, currentPage)],
          components: getComponents(),
        });
        return;
      }

      // 아이템 선택
      if (componentInteraction.customId === `shop_panel_select_${userId}` && componentInteraction.isStringSelectMenu()) {
        await handleItemSelection(componentInteraction, container, items, topyName, rubyName);
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {
        // 메시지 삭제됨
      }
    });
  } catch (error) {
    console.error('상점 패널 오류:', error);
    await interaction.editReply({
      content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
    });
  }
}

/** 아이템 선택 처리 */
async function handleItemSelection(
  interaction: StringSelectMenuInteraction,
  container: Container,
  items: ShopItemV2[],
  topyName: string,
  rubyName: string
) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const itemId = parseInt(interaction.values[0]!, 10);

  const selectedItem = items.find((item) => item.id === itemId);

  if (!selectedItem) {
    await interaction.reply({
      content: '아이템을 찾을 수 없습니다.',
      ephemeral: true,
    });
    return;
  }

  const currencyName = selectedItem.currencyType === 'topy' ? topyName : rubyName;
  const totalCost = selectedItem.price;

  // 구매 확인 Embed
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle('🛒 구매 확인')
    .setDescription(`**${selectedItem.name}**을(를) 구매하시겠습니까?`)
    .addFields(
      { name: '💰 가격', value: `${totalCost.toLocaleString()} ${currencyName}`, inline: true },
      { name: '⏰ 유효기간', value: selectedItem.durationDays > 0 ? `${selectedItem.durationDays}일` : '영구', inline: true }
    );

  if (selectedItem.description) {
    confirmEmbed.addFields({ name: '📝 설명', value: selectedItem.description });
  }

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shop_panel_confirm_${itemId}_${userId}`)
      .setLabel('구매하기')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`shop_panel_cancel_${userId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌')
  );

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [confirmRow],
    ephemeral: true,
  });

  // 구매 확인 버튼 이벤트 처리
  try {
    const buttonInteraction = await interaction.channel?.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === userId &&
        (i.customId === `shop_panel_confirm_${itemId}_${userId}` ||
          i.customId === `shop_panel_cancel_${userId}`),
      time: 30000,
    });

    if (!buttonInteraction) return;

    if (buttonInteraction.customId === `shop_panel_cancel_${userId}`) {
      await buttonInteraction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('❌ 구매 취소')
            .setDescription('구매가 취소되었습니다.'),
        ],
        components: [],
      });
      return;
    }

    // 구매 처리
    await buttonInteraction.deferUpdate();

    const purchaseResult = await container.shopV2Service.purchaseItem(
      guildId,
      userId,
      itemId
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
          errorMessage = '재고가 소진되었습니다.';
          break;
        case 'PURCHASE_LIMIT_EXCEEDED':
          errorMessage = `구매 한도를 초과했습니다. (최대 ${purchaseResult.error.maxPerUser}회)`;
          break;
        case 'INSUFFICIENT_BALANCE':
          const required = purchaseResult.error.required;
          const available = purchaseResult.error.available;
          errorMessage = `잔액이 부족합니다.\n필요: ${required.toLocaleString()} ${currencyName}\n보유: ${available.toLocaleString()} ${currencyName}`;
          break;
      }

      await buttonInteraction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 구매 실패')
            .setDescription(errorMessage),
        ],
        components: [],
      });
      return;
    }

    const { item, userItem, totalCost: paidAmount } = purchaseResult.data;

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 구매 완료!')
      .setDescription(`**${item.name}**을(를) 구매했습니다!`)
      .addFields(
        { name: '💰 지불 금액', value: `${paidAmount.toLocaleString()} ${currencyName}`, inline: true },
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

    await buttonInteraction.editReply({
      embeds: [successEmbed],
      components: [],
    });
  } catch {
    // 시간 초과
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('⏰ 시간 초과')
          .setDescription('구매 확인 시간이 초과되었습니다.'),
      ],
      components: [],
    });
  }
}
