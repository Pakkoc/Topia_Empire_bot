import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

      // 버튼 생성
      const isOwnProfile = targetUser.id === interaction.user.id;
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`myinfo_refresh_${targetUser.id}`)
          .setLabel('새로고침')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
      );

      // 본인 프로필이고 보유 색상이 있으면 색상 변경 버튼 추가
      if (isOwnProfile && colorTicketCount > 0) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`myinfo_color_${targetUser.id}`)
            .setLabel('닉네임 색상 변경')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎨')
        );
      }

      const response = await interaction.editReply({
        files: [attachment],
        components: [buttonRow],
      });

      // 버튼 클릭 이벤트 처리
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 120000, // 2분
      });

      collector.on('collect', async (buttonInteraction) => {
        // 색상 변경 버튼 클릭
        if (buttonInteraction.customId === `myinfo_color_${targetUser.id}`) {
          // 보유 색상 목록 다시 조회 (최신 상태)
          const latestColorsResult = await container.shopService.getOwnedColors(guildId, targetUser.id);
          if (!latestColorsResult.success || latestColorsResult.data.length === 0) {
            await buttonInteraction.reply({
              content: '보유한 색상이 없습니다. 상점에서 색상변경권을 구매해주세요.',
              ephemeral: true,
            });
            return;
          }

          const latestColors = latestColorsResult.data;

          // 색상 선택 드롭다운 생성
          const colorSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`myinfo_color_select_${targetUser.id}`)
            .setPlaceholder('적용할 색상을 선택하세요')
            .addOptions(
              latestColors
                .filter((c) => c.colorOption) // colorOption이 있는 것만
                .map((c) => ({
                  label: c.colorOption!.name,
                  description: c.colorOption!.color,
                  value: c.colorCode,
                  emoji: '🎨',
                }))
            );

          const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(colorSelectMenu);

          const colorEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🎨 닉네임 색상 변경')
            .setDescription('보유한 색상 중 적용할 색상을 선택하세요.')
            .addFields({
              name: '보유 색상',
              value: latestColors
                .filter((c) => c.colorOption)
                .map((c) => `${c.colorOption!.name} (${c.colorOption!.color})`)
                .join('\n') || '없음',
            });

          await buttonInteraction.reply({
            embeds: [colorEmbed],
            components: [selectRow],
            ephemeral: true,
          });

          // 색상 선택 대기
          try {
            const selectInteraction = await buttonInteraction.channel?.awaitMessageComponent({
              componentType: ComponentType.StringSelect,
              filter: (i) => i.user.id === interaction.user.id && i.customId === `myinfo_color_select_${targetUser.id}`,
              time: 30000,
            });

            if (!selectInteraction) return;

            const selectedColorCode = selectInteraction.values[0];
            if (!selectedColorCode) {
              await selectInteraction.update({
                embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 오류').setDescription('색상을 선택해주세요.')],
                components: [],
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

              await selectInteraction.update({
                embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 색상 적용 실패').setDescription(errorMessage)],
                components: [],
              });
              return;
            }

            const { roleIdToAdd, roleIdsToRemove } = applyResult.data;

            // Discord 역할 부여/제거
            try {
              const member = await interaction.guild?.members.fetch(targetUser.id);
              if (member) {
                // 기존 색상 역할 제거
                for (const roleId of roleIdsToRemove) {
                  if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(() => {});
                  }
                }

                // 새 색상 역할 부여
                const newRole = await interaction.guild?.roles.fetch(roleIdToAdd);
                if (newRole) {
                  await member.roles.add(newRole);
                }

                // 적용된 색상 정보 찾기
                const appliedColor = latestColors.find((c) => c.colorCode.toUpperCase() === selectedColorCode.toUpperCase());

                const successEmbed = new EmbedBuilder()
                  .setColor(parseInt(selectedColorCode.replace('#', ''), 16) || 0x00FF00)
                  .setTitle('✅ 색상 적용 완료!')
                  .setDescription(`**${appliedColor?.colorOption?.name ?? selectedColorCode}** 색상이 적용되었습니다.`)
                  .addFields({
                    name: '🎭 부여된 역할',
                    value: `<@&${roleIdToAdd}>`,
                    inline: true,
                  });

                await selectInteraction.update({
                  embeds: [successEmbed],
                  components: [],
                });
              }
            } catch (roleError) {
              console.error('역할 부여 오류:', roleError);
              await selectInteraction.update({
                embeds: [
                  new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('⚠️ 역할 부여 실패')
                    .setDescription('역할 부여 중 오류가 발생했습니다. 관리자에게 문의하세요.'),
                ],
                components: [],
              });
            }
          } catch {
            // 시간 초과
            await buttonInteraction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x808080)
                  .setTitle('⏰ 시간 초과')
                  .setDescription('색상 선택 시간이 초과되었습니다.'),
              ],
              components: [],
            });
          }
        }

        // 새로고침 버튼 클릭
        if (buttonInteraction.customId === `myinfo_refresh_${targetUser.id}`) {
          await buttonInteraction.deferUpdate();
          // TODO: 프로필 카드 재생성 로직
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
