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
import type { ShopItem, ItemType } from '@topia/core';

/** 아이템 타입 라벨 */
const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  role: '🎭 역할',
  color: '🎨 색상권',
  premium_room: '🏠 프리미엄 잠수방',
  random_box: '🎁 랜덤박스',
  warning_remove: '⚠️ 경고 차감',
  tax_exempt: '💸 세금 면제권',
  custom: '✨ 커스텀',
};

/** 상점 아이템을 Embed 형식으로 변환 */
function createShopEmbed(
  items: ShopItem[],
  topyName: string,
  rubyName: string,
  page: number = 0,
  itemsPerPage: number = 5
): EmbedBuilder {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const pageItems = items.slice(startIdx, startIdx + itemsPerPage);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛒 상점')
    .setDescription(
      items.length > 0
        ? '아래 메뉴에서 구매할 아이템을 선택하세요.'
        : '현재 판매 중인 아이템이 없습니다.'
    )
    .setTimestamp();

  if (pageItems.length > 0) {
    const fields = pageItems.map((item, idx) => {
      const currencyName = item.currencyType === 'topy' ? topyName : rubyName;
      const typeLabel = ITEM_TYPE_LABELS[item.itemType] || item.itemType;

      let info = `${typeLabel}\n💰 **${item.price.toLocaleString()}** ${currencyName}`;

      if (item.durationDays) {
        info += `\n⏰ ${item.durationDays}일`;
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
  items: ShopItem[],
  topyName: string,
  rubyName: string,
  customId: string
): StringSelectMenuBuilder {
  const options = items.slice(0, 25).map((item) => {
    const currencyName = item.currencyType === 'topy' ? topyName : rubyName;
    const typeEmoji = ITEM_TYPE_LABELS[item.itemType]?.split(' ')[0] || '✨';

    return {
      label: item.name,
      description: `${item.price.toLocaleString()} ${currencyName}`,
      value: item.id.toString(),
      emoji: typeEmoji,
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('구매할 아이템을 선택하세요')
    .addOptions(options);
}

export const shopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('상점')
    .setDescription('상점에서 아이템을 확인하고 구매합니다'),

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

    await interaction.deferReply();

    try {
      // 상점 아이템 조회
      const itemsResult = await container.shopService.getShopItems(guildId, true);
      if (!itemsResult.success) {
        await interaction.editReply({
          content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
        });
        return;
      }

      const items = itemsResult.data;

      // 화폐 설정 조회
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
      const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

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

      // 상점 Embed 생성
      const embed = createShopEmbed(items, topyName, rubyName);

      // 아이템 선택 메뉴 생성
      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        createSelectMenu(items, topyName, rubyName, `shop_select_${userId}`)
      );

      const response = await interaction.editReply({
        embeds: [embed],
        components: [selectRow],
      });

      // 아이템 선택 이벤트 처리
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === userId && i.customId === `shop_select_${userId}`,
        time: 60000,
      });

      collector.on('collect', async (selectInteraction) => {
        const selectedValue = selectInteraction.values[0];
        if (!selectedValue) {
          await selectInteraction.reply({
            content: '아이템을 선택해주세요.',
            ephemeral: true,
          });
          return;
        }

        const itemId = parseInt(selectedValue, 10);
        const selectedItem = items.find((item) => item.id === itemId);

        if (!selectedItem) {
          await selectInteraction.reply({
            content: '아이템을 찾을 수 없습니다.',
            ephemeral: true,
          });
          return;
        }

        const currencyName = selectedItem.currencyType === 'topy' ? topyName : rubyName;
        const typeLabel = ITEM_TYPE_LABELS[selectedItem.itemType] || selectedItem.itemType;

        // 수수료 계산 (1.2%)
        const feePercent = 1.2;
        const fee = (selectedItem.price * BigInt(Math.round(feePercent * 10))) / BigInt(1000);
        const totalCost = selectedItem.price + fee;

        // 구매 확인 Embed
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('🛒 구매 확인')
          .setDescription(`**${selectedItem.name}**을(를) 구매하시겠습니까?`)
          .addFields(
            { name: '타입', value: typeLabel, inline: true },
            { name: '가격', value: `${selectedItem.price.toLocaleString()} ${currencyName}`, inline: true },
            { name: '수수료 (1.2%)', value: `${fee.toLocaleString()} ${currencyName}`, inline: true },
            { name: '총 비용', value: `**${totalCost.toLocaleString()}** ${currencyName}`, inline: false }
          );

        if (selectedItem.description) {
          confirmEmbed.addFields({ name: '설명', value: selectedItem.description });
        }

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`shop_confirm_${itemId}_${userId}`)
            .setLabel('구매하기')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`shop_cancel_${userId}`)
            .setLabel('취소')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );

        await selectInteraction.reply({
          embeds: [confirmEmbed],
          components: [confirmRow],
          ephemeral: true,
        });

        // 구매 확인 버튼 이벤트 처리
        try {
          const buttonInteraction = await selectInteraction.channel?.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (i) =>
              i.user.id === userId &&
              (i.customId === `shop_confirm_${itemId}_${userId}` ||
                i.customId === `shop_cancel_${userId}`),
            time: 30000,
          });

          if (!buttonInteraction) return;

          if (buttonInteraction.customId === `shop_cancel_${userId}`) {
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

          const purchaseResult = await container.shopService.purchaseItem(
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

          const { item, price, fee: actualFee, newBalance } = purchaseResult.data;

          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ 구매 완료!')
            .setDescription(`**${item.name}**을(를) 구매했습니다!`)
            .addFields(
              { name: '💰 지불 금액', value: `${price.toLocaleString()} ${currencyName}`, inline: true },
              { name: '📋 수수료', value: `${actualFee.toLocaleString()} ${currencyName}`, inline: true },
              { name: '💵 남은 잔액', value: `${newBalance.toLocaleString()} ${currencyName}`, inline: true }
            )
            .setTimestamp();

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
                .setDescription('구매 확인 시간이 초과되었습니다.'),
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
      console.error('상점 명령어 오류:', error);
      await interaction.editReply({
        content: '상점 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },
};
