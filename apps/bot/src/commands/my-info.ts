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

      // 보유 색상 개수 가져오기 (V2 역할선택권으로 이전됨 - 추후 인벤토리 연동 필요)
      // TODO: 인벤토리 시스템을 통해 색상 변경권 연동
      const colorTicketCount = 0;

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

      // 본인 프로필인 경우 기능 드롭다운 표시
      const isOwnProfile = targetUser.id === interaction.user.id;
      const components: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

      if (isOwnProfile) {
        const menuOptions: Array<{
          label: string;
          description: string;
          value: string;
          emoji: string;
        }> = [];

        // 보유 색상이 있으면 색상변경권 옵션 추가
        if (colorTicketCount > 0) {
          menuOptions.push({
            label: '색상변경권',
            description: `보유한 색상으로 닉네임 색상을 변경합니다 (${colorTicketCount}개 보유)`,
            value: 'color_change',
            emoji: '🎨',
          });
        }

        // TODO: 추후 다른 기능 옵션 추가 가능
        // menuOptions.push({
        //   label: '다른 기능',
        //   description: '설명',
        //   value: 'other_feature',
        //   emoji: '🔧',
        // });

        // 옵션이 있을 때만 드롭다운 추가
        if (menuOptions.length > 0) {
          const functionMenu = new StringSelectMenuBuilder()
            .setCustomId(`myinfo_menu_${targetUser.id}`)
            .setPlaceholder('🔧 기능 선택')
            .addOptions(menuOptions);

          components.push(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(functionMenu)
          );
        }
      }

      const response = await interaction.editReply({
        files: [attachment],
        components,
      });

      // 드롭다운이 없으면 이벤트 리스너 불필요
      if (components.length === 0) return;

      // 기능 선택 이벤트 처리
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id && i.customId === `myinfo_menu_${targetUser.id}`,
        time: 120000, // 2분
      });

      collector.on('collect', async (selectInteraction) => {
        const selectedValue = selectInteraction.values[0];

        // TODO: 색상변경권 기능은 V2 인벤토리 시스템으로 이전됨
        // 추후 /인벤토리 명령어를 통해 역할 교환 기능으로 제공될 예정
        if (selectedValue === 'color_change') {
          await selectInteraction.reply({
            content: '색상변경권 기능은 `/인벤토리` 명령어를 통해 이용하실 수 있습니다.',
            ephemeral: true,
          });
          return;
        }

        // TODO: 다른 기능 처리 추가
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
