import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from './types';

/** HEX 색상 유효성 검사 */
function isValidHexColor(color: string): boolean {
  return /^#?([0-9A-Fa-f]{6})$/.test(color);
}

/** HEX 문자열을 정수로 변환 */
function hexToInt(hex: string): number {
  const cleanHex = hex.replace('#', '');
  return parseInt(cleanHex, 16);
}

/** 색상 역할 이름 생성 */
function getColorRoleName(hex: string): string {
  return `🎨 ${hex.toUpperCase()}`;
}

export const colorChangeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('색상변경')
    .setDescription('색상변경권을 사용하여 닉네임 색상을 변경합니다')
    .addStringOption(option =>
      option
        .setName('색상')
        .setDescription('원하는 색상 (예: #FF0000, FF0000)')
        .setRequired(true)
    ),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const colorInput = interaction.options.getString('색상', true);

    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 색상 형식 검증
    const hexColor = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
    if (!isValidHexColor(hexColor)) {
      await interaction.reply({
        content: '올바른 색상 형식이 아닙니다. 예: `#FF0000` 또는 `FF0000`',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. 색상변경권 보유 확인 및 사용
      const useResult = await container.shopService.useItem(guildId, userId, 'color');

      if (!useResult.success) {
        let errorMessage = '색상변경권 사용 중 오류가 발생했습니다.';

        switch (useResult.error.type) {
          case 'ITEM_NOT_OWNED':
            errorMessage = '색상변경권을 보유하고 있지 않습니다.\n상점에서 구매해주세요.';
            break;
          case 'ITEM_EXPIRED':
            errorMessage = '색상변경권이 만료되었습니다.';
            break;
        }

        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ 색상 변경 실패')
          .setDescription(errorMessage);

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // 2. 기존 색상 역할 제거
      const member = await interaction.guild.members.fetch(userId);
      const colorRolePrefix = '🎨 #';
      const existingColorRoles = member.roles.cache.filter(
        role => role.name.startsWith(colorRolePrefix)
      );

      for (const [, role] of existingColorRoles) {
        await member.roles.remove(role);
      }

      // 3. 새 색상 역할 찾기 또는 생성
      const roleName = getColorRoleName(hexColor);
      let colorRole = interaction.guild.roles.cache.find(
        role => role.name === roleName
      );

      if (!colorRole) {
        // 역할이 없으면 생성
        const botMember = await interaction.guild.members.fetchMe();
        const botHighestRole = botMember.roles.highest;

        colorRole = await interaction.guild.roles.create({
          name: roleName,
          color: hexToInt(hexColor),
          position: botHighestRole.position - 1, // 봇 역할 바로 아래
          permissions: [],
          reason: `색상변경권 사용 - ${interaction.user.tag}`,
        });
      }

      // 4. 역할 부여
      await member.roles.add(colorRole);

      const successEmbed = new EmbedBuilder()
        .setColor(hexToInt(hexColor))
        .setTitle('✅ 색상 변경 완료!')
        .setDescription(`닉네임 색상이 **${hexColor.toUpperCase()}**로 변경되었습니다!`)
        .addFields({
          name: '🎨 남은 색상변경권',
          value: `${useResult.data.remainingQuantity}개`,
          inline: true,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error('색상 변경 오류:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ 색상 변경 실패')
        .setDescription('색상 변경 중 오류가 발생했습니다.\n봇의 역할 권한을 확인해주세요.');

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
