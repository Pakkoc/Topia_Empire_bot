import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from './types';

export const itemGiveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('아이템지급')
    .setDescription('유저에게 아이템을 지급합니다 (아이템 관리자 전용)')
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('지급받을 유저')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('아이템')
        .setDescription('지급할 아이템')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option
        .setName('수량')
        .setDescription('지급할 수량 (기본: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(999)
    )
    .addStringOption(option =>
      option
        .setName('사유')
        .setDescription('지급 사유 (선택)')
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
            name: `${item.name}${item.durationDays > 0 ? ` (${item.durationDays}일)` : ''}`,
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
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 권한 체크: 설정된 역할 또는 관리자
    const settingsResult = await container.currencyService.getSettings(guildId);
    const settings = settingsResult.success ? settingsResult.data : null;
    const itemManagerRoleId = settings?.itemManagerRoleId;
    const itemLogChannelId = settings?.itemLogChannelId;

    const member = interaction.member;
    const hasManagerRole = itemManagerRoleId && member && 'roles' in member &&
      (Array.isArray(member.roles)
        ? member.roles.includes(itemManagerRoleId)
        : member.roles.cache.has(itemManagerRoleId));
    const isAdmin = member && 'permissions' in member &&
      member.permissions instanceof Object &&
      'has' in member.permissions &&
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasManagerRole && !isAdmin) {
      await interaction.reply({
        content: itemManagerRoleId
          ? '이 명령어는 아이템 관리자 역할을 가진 유저만 사용할 수 있습니다.'
          : '이 명령어는 관리자만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        content: '봇에게는 아이템을 지급할 수 없습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const result = await container.shopService.giveItem(
        guildId,
        targetUser.id,
        itemId,
        quantity
      );

      if (!result.success) {
        let errorMessage = '아이템 지급 중 오류가 발생했습니다.';

        switch (result.error.type) {
          case 'ITEM_NOT_FOUND':
            errorMessage = '해당 아이템을 찾을 수 없습니다.';
            break;
          case 'INVALID_QUANTITY':
            errorMessage = '올바르지 않은 수량입니다.';
            break;
        }

        const errorContainer = new ContainerBuilder()
          .setAccentColor(0xFF0000)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('# ❌ 지급 실패')
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

      const { item, userItem } = result.data;

      let infoText = `📦 **보유 수량**: ${userItem.quantity}개`;

      if (userItem.expiresAt) {
        const daysLeft = Math.ceil(
          (new Date(userItem.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        infoText += `\n⏰ **만료일**: ${daysLeft}일 남음`;
      }

      if (reason) {
        infoText += `\n📝 **사유**: ${reason}`;
      }

      const successContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ✅ 아이템 지급 완료!')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${targetUser.displayName}**님에게 **${item.name}** ${quantity}개를 지급했습니다.`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(infoText)
        );

      // 로그 채널이 설정되어 있으면 해당 채널로 전송
      if (itemLogChannelId) {
        const logChannel = await interaction.guild?.channels.fetch(itemLogChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
          const logContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent('# 🎁 아이템 지급 내역')
            )
            .addSeparatorComponents(
              new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**${interaction.user.displayName}**(관리자) → **${targetUser.displayName}**\n` +
                `아이템: **${item.name}** ${quantity}개` +
                (reason ? `\n📝 사유: ${reason}` : '')
              )
            );

          await logChannel.send({
            components: [logContainer.toJSON()],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        await interaction.editReply({
          content: `✅ **${targetUser.displayName}**님에게 **${item.name}** ${quantity}개를 지급했습니다.`,
        });
      } else {
        await interaction.editReply({
          components: [successContainer.toJSON()],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // 받는 사람에게 DM 알림
      const guildName = interaction.guild?.name ?? '서버';
      const reasonText = reason ? `\n📝 사유: ${reason}` : '';

      const dmContainer = new ContainerBuilder()
        .setAccentColor(0x00FF00)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 🎁 아이템 지급 알림')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${guildName}**에서 관리자가 **${item.name}** ${quantity}개를 지급했습니다.${reasonText}`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `📦 **보유 수량**: ${userItem.quantity}개`
          )
        );

      targetUser.send({
        components: [dmContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    } catch (error) {
      console.error('아이템 지급 명령어 오류:', error);
      await interaction.editReply({
        content: '아이템 지급 처리 중 오류가 발생했습니다.',
      });
    }
  },
};
