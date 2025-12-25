import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from './types';

export const marketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('장터패널')
    .setDescription('장터 패널을 설치합니다 (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, container) {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 화폐 설정 조회
    const settingsResult = await container.currencyService.getSettings(guildId);
    const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';
    const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

    // 패널 Embed 생성
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🛒 토피아 장터')
      .setDescription(
        '재능과 서비스를 자유롭게 거래하세요!\n\n' +
        '아래 버튼을 클릭하여 장터를 이용할 수 있습니다.'
      )
      .addFields(
        { name: `💰 ${topyName} 수수료`, value: '5%', inline: true },
        { name: `💎 ${rubyName} 수수료`, value: '3%', inline: true },
        { name: '⏰ 등록 유효기간', value: '30일', inline: true }
      )
      .setFooter({ text: '거래 시 발생하는 분쟁은 관리자에게 문의하세요.' })
      .setTimestamp();

    // 버튼 생성
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('market_panel_list')
        .setLabel('목록보기')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('market_panel_register')
        .setLabel('등록하기')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('market_panel_my')
        .setLabel('내상품')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📦')
    );

    const channel = interaction.channel;
    if (!channel || !('send' in channel)) {
      await interaction.reply({
        content: '이 채널에서는 패널을 설치할 수 없습니다.',
        ephemeral: true,
      });
      return;
    }

    // 패널 메시지 전송 (ephemeral이 아닌 일반 메시지로)
    await interaction.reply({
      content: '✅ 장터 패널이 설치되었습니다. 이 메시지를 고정하세요!',
      ephemeral: true,
    });

    // 채널에 패널 메시지 전송
    await channel.send({
      embeds: [embed],
      components: [buttonRow],
    });
  },
};
