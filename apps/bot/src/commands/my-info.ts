import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from './types';
import { generateProfileCard, type ProfileCardData } from '../utils/canvas/profile-card';

export const myInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('내정보')
    .setDescription('내 프로필 정보를 확인합니다')
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('조회할 유저 (미입력 시 본인)')
        .setRequired(false)
    ),

  async execute(interaction, container) {
    const targetUser = interaction.options.getUser('유저') ?? interaction.user;
    const guildId = interaction.guildId;

    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      // 멤버 정보 가져오기
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await interaction.editReply({
          content: '유저 정보를 찾을 수 없습니다.',
        });
        return;
      }

      // XP 정보 가져오기
      const xpResult = await container.xpService.getUserXp(guildId, targetUser.id);
      const userXp = xpResult.success ? xpResult.data : null;

      // 화폐 정보 가져오기
      const walletsResult = await container.currencyService.getWallets(guildId, targetUser.id);
      const wallets = walletsResult.success ? walletsResult.data : { topy: null, ruby: null };

      // 화폐 설정 가져오기
      const settingsResult = await container.currencyService.getSettings(guildId);
      const topyName = settingsResult.success && settingsResult.data?.topyName || '토피';
      const rubyName = settingsResult.success && settingsResult.data?.rubyName || '루비';

      // 보유 색상 개수 가져오기
      const ownedColorsResult = await container.shopService.getOwnedColors(guildId, targetUser.id);
      const ownedColors = ownedColorsResult.success ? ownedColorsResult.data : [];
      const colorTicketCount = ownedColors.length;

      // 프로필 카드 데이터 구성
      const profileData: ProfileCardData = {
        avatarUrl: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
        displayName: member.displayName,
        joinedAt: member.joinedAt ?? new Date(),
        attendanceCount: 0, // TODO: 출석 시스템 구현 후 연동
        statusMessage: member.presence?.activities[0]?.name,
        voiceLevel: userXp?.level ?? 0, // TODO: voice/chat 분리 시 수정
        chatLevel: userXp?.level ?? 0,
        isPremium: member.premiumSince !== null,
        topyBalance: wallets.topy?.balance ?? BigInt(0),
        rubyBalance: wallets.ruby?.balance ?? BigInt(0),
        topyName,
        rubyName,
        clanName: undefined, // TODO: 클랜 시스템 구현 후 연동
        warningCount: 0, // TODO: 경고 시스템 구현 후 연동
        warningRemovalCount: 0,
        colorTicketCount,
      };

      // 이미지 생성
      const imageBuffer = await generateProfileCard(profileData);
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: 'profile.png',
      });

      // 본인 프로필이고 보유 색상이 있으면 색상 선택 드롭다운 표시
      const isOwnProfile = targetUser.id === interaction.user.id;
      const components: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

      if (isOwnProfile && colorTicketCount > 0) {
        const validColors = ownedColors.filter((c) => c.colorOption);

        if (validColors.length > 0) {
          const colorMenu = new StringSelectMenuBuilder()
            .setCustomId(`myinfo_color_${targetUser.id}`)
            .setPlaceholder('🎨 닉네임 색상 변경')
            .addOptions(
              validColors.map((c) => ({
                label: c.colorOption!.name,
                description: c.colorOption!.color,
                value: c.colorCode,
                emoji: '🎨',
              }))
            );

          components.push(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(colorMenu)
          );
        }
      }

      const response = await interaction.editReply({
        files: [attachment],
        components,
      });

      // 드롭다운이 없으면 이벤트 리스너 불필요
      if (components.length === 0) return;

      // 색상 선택 이벤트 처리
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id && i.customId === `myinfo_color_${targetUser.id}`,
        time: 120000, // 2분
      });

      collector.on('collect', async (selectInteraction) => {
        const selectedColorCode = selectInteraction.values[0];
        if (!selectedColorCode) {
          await selectInteraction.reply({
            content: '색상을 선택해주세요.',
            ephemeral: true,
          });
          return;
        }

        // 색상 적용 처리
        const applyResult = await container.shopService.applyColor(guildId, targetUser.id, selectedColorCode);

        if (!applyResult.success) {
          let errorMessage = '색상 적용 중 오류가 발생했습니다.';
          if (applyResult.error.type === 'COLOR_NOT_OWNED') {
            errorMessage = '해당 색상을 보유하고 있지 않습니다.';
          } else if (applyResult.error.type === 'COLOR_OPTION_NOT_FOUND') {
            errorMessage = '색상 정보를 찾을 수 없습니다. 관리자에게 문의하세요.';
          }

          await selectInteraction.reply({
            embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 색상 적용 실패').setDescription(errorMessage)],
            ephemeral: true,
          });
          return;
        }

        const { roleIdToAdd, roleIdsToRemove } = applyResult.data;

        // Discord 역할 부여/제거
        try {
          const targetMember = await interaction.guild?.members.fetch(targetUser.id);
          if (targetMember) {
            // 기존 색상 역할 제거
            for (const roleId of roleIdsToRemove) {
              if (targetMember.roles.cache.has(roleId)) {
                await targetMember.roles.remove(roleId).catch(() => {});
              }
            }

            // 새 색상 역할 부여
            const newRole = await interaction.guild?.roles.fetch(roleIdToAdd);
            if (newRole) {
              await targetMember.roles.add(newRole);
            }

            // 적용된 색상 정보 찾기
            const appliedColor = ownedColors.find((c) => c.colorCode.toUpperCase() === selectedColorCode.toUpperCase());

            const successEmbed = new EmbedBuilder()
              .setColor(parseInt(selectedColorCode.replace('#', ''), 16) || 0x00FF00)
              .setTitle('✅ 색상 적용 완료!')
              .setDescription(`**${appliedColor?.colorOption?.name ?? selectedColorCode}** 색상이 적용되었습니다.`)
              .addFields({
                name: '🎭 부여된 역할',
                value: `<@&${roleIdToAdd}>`,
                inline: true,
              });

            await selectInteraction.reply({
              embeds: [successEmbed],
              ephemeral: true,
            });
          }
        } catch (roleError) {
          console.error('역할 부여 오류:', roleError);
          await selectInteraction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('⚠️ 역할 부여 실패')
                .setDescription('역할 부여 중 오류가 발생했습니다. 관리자에게 문의하세요.'),
            ],
            ephemeral: true,
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
      console.error('프로필 카드 생성 오류:', error);
      await interaction.editReply({
        content: '프로필 정보를 불러오는 중 오류가 발생했습니다.',
      });
    }
  },
};
