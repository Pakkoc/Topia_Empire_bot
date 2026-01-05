import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from './types';

export const itemTakeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('아이템회수')
    .setDescription('유저의 아이템을 회수합니다 (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('회수할 유저')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('아이템')
        .setDescription('회수할 아이템')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option
        .setName('수량')
        .setDescription('회수할 수량 (기본: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(999)
    )
    .addStringOption(option =>
      option
        .setName('사유')
        .setDescription('회수 사유 (선택)')
        .setRequired(false)
    ),

  async autocomplete(interaction, container) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.respond([]);
      return;
    }

    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === '아이템') {
      try {
        // 유저 옵션에서 타겟 유저 ID 가져오기
        const targetUserId = interaction.options.get('유저')?.value as string | undefined;

        if (!targetUserId) {
          // 유저가 선택되지 않은 경우 전체 아이템 목록 표시
          const itemsResult = await container.shopService.getShopItems(guildId);
          if (!itemsResult.success) {
            await interaction.respond([]);
            return;
          }

          const searchValue = focusedOption.value.toLowerCase();
          const filtered = itemsResult.data
            .filter(item => item.name.toLowerCase().includes(searchValue))
            .slice(0, 25);

          await interaction.respond(
            filtered.map(item => ({
              name: item.name,
              value: item.id.toString(),
            }))
          );
          return;
        }

        // 유저가 선택된 경우 해당 유저가 보유한 아이템만 표시
        const userItemsResult = await container.shopService.getUserItems(guildId, targetUserId);
        if (!userItemsResult.success || userItemsResult.data.length === 0) {
          await interaction.respond([]);
          return;
        }

        // 아이템 정보 조회
        const itemsResult = await container.shopService.getShopItems(guildId);
        if (!itemsResult.success) {
          await interaction.respond([]);
          return;
        }

        const itemMap = new Map(itemsResult.data.map(item => [item.id, item]));
        const searchValue = focusedOption.value.toLowerCase();

        const userItemsWithInfo = userItemsResult.data
          .filter(ui => ui.quantity > 0)
          .map(ui => {
            const item = itemMap.get(ui.shopItemId);
            return item ? { userItem: ui, item } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .filter(x => x.item.name.toLowerCase().includes(searchValue))
          .slice(0, 25);

        await interaction.respond(
          userItemsWithInfo.map(({ userItem, item }) => ({
            name: `${item.name} (보유: ${userItem.quantity}개)`,
            value: item.id.toString(),
          }))
        );
      } catch {
        await interaction.respond([]);
      }
    } else {
      await interaction.respond([]);
    }
  },

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser('유저', true);
    const itemId = parseInt(interaction.options.getString('아이템', true), 10);
    const quantity = interaction.options.getInteger('수량') ?? 1;
    const reason = interaction.options.getString('사유') ?? undefined;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 없습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const result = await container.shopService.takeItem(
        guildId,
        targetUser.id,
        itemId,
        quantity
      );

      if (!result.success) {
        let errorMessage = '아이템 회수 중 오류가 발생했습니다.';

        switch (result.error.type) {
          case 'ITEM_NOT_FOUND':
            errorMessage = '해당 아이템을 찾을 수 없습니다.';
            break;
          case 'ITEM_NOT_OWNED':
            errorMessage = '해당 유저가 이 아이템을 보유하고 있지 않습니다.';
            break;
          case 'INSUFFICIENT_QUANTITY':
            errorMessage = `수량이 부족합니다. (필요: ${result.error.required}개, 보유: ${result.error.available}개)`;
            break;
          case 'INVALID_QUANTITY':
            errorMessage = '올바르지 않은 수량입니다.';
            break;
        }

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 회수 실패')
          .setDescription(errorMessage)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const { remainingQuantity, item } = result.data;

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('✅ 아이템 회수 완료!')
        .setDescription(
          `**${targetUser.displayName}**님에게서 **${item.name}** ${quantity}개를 회수했습니다.`
        )
        .addFields(
          { name: '📦 남은 수량', value: `${remainingQuantity}개`, inline: true },
        );

      if (reason) {
        embed.addFields({ name: '📝 사유', value: reason, inline: false });
      }

      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // 회수 대상에게 DM 알림
      const guildName = interaction.guild?.name ?? '서버';
      const reasonText = reason ? `\n사유: ${reason}` : '';

      const dmEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('📦 아이템 회수 알림')
        .setDescription(
          `**${guildName}**에서 관리자가 **${item.name}** ${quantity}개를 회수했습니다.${reasonText}`
        )
        .addFields(
          { name: '📦 남은 수량', value: `${remainingQuantity}개`, inline: true },
        )
        .setTimestamp();

      targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (error) {
      console.error('아이템 회수 명령어 오류:', error);
      await interaction.editReply({
        content: '아이템 회수 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
