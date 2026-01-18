import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type TextChannel,
  type UserSelectMenuInteraction,
  type StringSelectMenuInteraction,
  type APIContainerComponent,
} from 'discord.js';
import type { GameService, CurrencyService, Game, GameParticipant, GameCategory, RankRewards } from '@topia/core';

// Components v2 플래그 (1 << 15)
const IS_COMPONENTS_V2 = 32768;

interface Container {
  gameService: GameService;
  currencyService: CurrencyService;
}

// 메시지 삭제 딜레이 설정
const SHORT_DELETE_DELAY = 30 * 1000;       // 30초 - 에러, 확인 메시지
const LONG_DELETE_DELAY = 5 * 60 * 1000;    // 5분 - 팀 배정 UI, 결과 메시지

function scheduleEphemeralDelete(interaction: ButtonInteraction | ModalSubmitInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction | any, delay: number = SHORT_DELETE_DELAY) {
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch {
      // 이미 삭제됨
    }
  }, delay);
}

// ============================================================
// 헬퍼 함수들
// ============================================================

/**
 * 내전 메시지 Container 생성 (Components v2)
 */
function createGameContainer(
  game: Game,
  topyName: string,
  participants: GameParticipant[] = [],
  rankRewards?: Record<number, number>
): APIContainerComponent {
  const container = new ContainerBuilder();

  // 상태별 이모지
  const statusText = {
    'pending_approval': '⏳ 승인 대기',
    'open': '🟢 모집중',
    'team_assign': '🟡 팀 배정중',
    'in_progress': '🔵 경기중',
    'finished': '✅ 완료',
    'cancelled': '❌ 취소됨',
  };

  // 헤더
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# 🎮 ${game.title}`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**상태: ${statusText[game.status]}**`)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 참가 정보
  const participantText = game.maxPlayersPerTeam !== null
    ? `${participants.length}/${game.maxPlayersPerTeam * game.teamCount}명`
    : `${participants.length}명`;

  let infoText = `💰 **참가비**: ${game.entryFee.toLocaleString()} ${topyName}\n`;
  infoText += `👥 **참가자**: ${participantText}\n`;
  infoText += `🏆 **상금 풀**: ${game.totalPool.toLocaleString()} ${topyName}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  // 보상 비율 표시 (동적 순위 지원)
  if (game.status === 'open') {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    if (game.customWinnerTakesAll) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('🎁 **순위별 보상**: 🏆 승자 독식 (1등 100%)')
      );
    } else if (game.customRankRewards) {
      const total = Object.values(game.customRankRewards).reduce((a, b) => a + b, 0);
      const rewardEntries = Object.entries(game.customRankRewards)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([rank, ratio]) => {
          const percent = total > 0 ? Math.round((ratio / total) * 100) : 0;
          return `${rank}등: ${percent}%`;
        })
        .join(' | ');

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`🎁 **순위별 보상 (커스텀)**: ${rewardEntries}`)
      );
    } else if (rankRewards) {
      const total = Object.values(rankRewards).reduce((a, b) => a + b, 0);
      const rewardEntries = Object.entries(rankRewards)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .filter(([, ratio]) => ratio > 0)
        .map(([rank, ratio]) => {
          const percent = total > 0 ? Math.round((ratio / total) * 100) : 0;
          return `${rank}등: ${percent}%`;
        })
        .join(' | ');

      if (rewardEntries) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`🎁 **순위별 보상**: ${rewardEntries}`)
        );
      }
    }
  }

  // 참가자 목록 / 팀 배정 현황
  if (participants.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // 팀별 멤버 분류
    const teamMembers: Record<number, GameParticipant[]> = {};
    const unassignedMembers: GameParticipant[] = [];
    for (const p of participants) {
      if (p.teamNumber === null) {
        unassignedMembers.push(p);
      } else {
        if (!teamMembers[p.teamNumber]) {
          teamMembers[p.teamNumber] = [];
        }
        teamMembers[p.teamNumber]!.push(p);
      }
    }

    // 팀에 배정된 멤버가 있는지 확인
    const hasAssignedMembers = Object.keys(teamMembers).length > 0;

    if (game.status === 'open' || game.status === 'team_assign') {
      // 팀 배정 현황 표시 (배정된 멤버가 있을 경우)
      if (hasAssignedMembers) {
        let teamsText = '**📊 팀 배정 현황**\n';
        for (let teamNum = 1; teamNum <= game.teamCount; teamNum++) {
          const members = teamMembers[teamNum] || [];
          const teamEmoji = getTeamEmoji(teamNum);
          if (members.length > 0) {
            const memberMentions = members.map(p => `<@${p.userId}>`).join(', ');
            teamsText += `${teamEmoji} **${teamNum}팀**: ${memberMentions}\n`;
          } else {
            teamsText += `${teamEmoji} **${teamNum}팀**: (없음)\n`;
          }
        }
        if (unassignedMembers.length > 0) {
          const unassignedMentions = unassignedMembers.map(p => `<@${p.userId}>`).join(', ');
          teamsText += `\n⏳ **미배정**: ${unassignedMentions}`;
        }
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(teamsText.trim())
        );
      } else {
        // 아직 팀 배정이 없으면 참가자 목록만 표시
        const participantMentions = participants.map(p => `<@${p.userId}>`).join(', ');
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**📋 참가자 목록**\n${participantMentions.length > 900 ? participantMentions.substring(0, 897) + '...' : participantMentions}`
          )
        );
      }
    } else if (game.status === 'in_progress' || game.status === 'finished') {
      let teamsText = '';
      for (let teamNum = 1; teamNum <= game.teamCount; teamNum++) {
        const members = teamMembers[teamNum] || [];
        if (members.length > 0) {
          const teamEmoji = getTeamEmoji(teamNum);
          const memberMentions = members.map(p => `<@${p.userId}>`).join(', ');
          teamsText += `${teamEmoji} **${teamNum}팀**: ${memberMentions}\n`;
        }
      }
      if (teamsText) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(teamsText.trim())
        );
      }
    }
  }

  return container.toJSON();
}

/**
 * 팀 이모지 반환
 */
function getTeamEmoji(teamNumber: number): string {
  const emojis = ['🔵', '🔴', '🟢', '🟡', '🟣', '🟠', '⚪', '⚫'];
  return emojis[(teamNumber - 1) % emojis.length] || '🔷';
}

/**
 * 내전 메시지 버튼 생성
 */
function createGameButtons(game: Game, isAdmin: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (game.status === 'open') {
    // 1행: 참가 버튼
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`game_join_${game.id}`)
          .setLabel('참가하기')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`game_leave_${game.id}`)
          .setLabel('참가 취소')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      )
    );

    // 2행: 팀 선택 버튼 (참가자 자유 이동)
    const teamButtons: ButtonBuilder[] = [];
    for (let i = 1; i <= game.teamCount && i <= 5; i++) {
      teamButtons.push(
        new ButtonBuilder()
          .setCustomId(`game_team_self_${game.id}_${i}`)
          .setLabel(`${i}팀`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(getTeamEmoji(i))
      );
    }
    if (teamButtons.length > 0) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...teamButtons)
      );
    }

    // 3행: 관리자/방장 버튼
    if (isAdmin) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`game_team_assign_${game.id}`)
            .setLabel('팀 배정')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎲'),
          new ButtonBuilder()
            .setCustomId(`game_cancel_${game.id}`)
            .setLabel('취소')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        )
      );
    }
  } else if (game.status === 'team_assign') {
    // 1행: 팀 선택 버튼 (참가자 자유 이동)
    const teamButtons: ButtonBuilder[] = [];
    for (let i = 1; i <= game.teamCount && i <= 5; i++) {
      teamButtons.push(
        new ButtonBuilder()
          .setCustomId(`game_team_self_${game.id}_${i}`)
          .setLabel(`${i}팀`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(getTeamEmoji(i))
      );
    }
    if (teamButtons.length > 0) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...teamButtons)
      );
    }

    // 2행: 관리자/방장 버튼
    if (isAdmin) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`game_team_assign_${game.id}`)
            .setLabel('팀 배정')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎲'),
          new ButtonBuilder()
            .setCustomId(`game_kick_${game.id}`)
            .setLabel('퇴장')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🚪'),
          new ButtonBuilder()
            .setCustomId(`game_start_${game.id}`)
            .setLabel('경기 시작')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️'),
          new ButtonBuilder()
            .setCustomId(`game_cancel_${game.id}`)
            .setLabel('취소')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        )
      );
    }
  } else if (game.status === 'in_progress') {
    // 관리자/방장: 결과 입력
    if (isAdmin) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`game_result_${game.id}`)
            .setLabel('결과 입력')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🏆'),
          new ButtonBuilder()
            .setCustomId(`game_cancel_${game.id}`)
            .setLabel('취소')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        )
      );
    }
  }

  return rows;
}

/**
 * 관리자 권한 확인
 */
function isAdminUser(interaction: ButtonInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction, managerRoleId: string | null): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  if (managerRoleId && interaction.member) {
    const memberRoles = interaction.member.roles;
    if (Array.isArray(memberRoles)) {
      return memberRoles.includes(managerRoleId);
    } else {
      return memberRoles.cache.has(managerRoleId);
    }
  }

  return false;
}

/**
 * 게임 생성자(방장) 확인
 */
function isGameCreator(
  interaction: ButtonInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction,
  game: Game
): boolean {
  return interaction.user.id === game.createdBy;
}

/**
 * 관리자 또는 방장 권한 확인
 */
function isAdminOrCreator(
  interaction: ButtonInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction,
  managerRoleId: string | null,
  game: Game
): boolean {
  return isAdminUser(interaction, managerRoleId) || isGameCreator(interaction, game);
}

// ============================================================
// 패널 버튼 핸들러
// ============================================================

/**
 * 내전 패널 - 내전 생성 버튼 (직접 입력)
 */
export async function handleGamePanelCreate(
  interaction: ButtonInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 설정 조회
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;
  const approvalChannelId = settingsResult.success ? settingsResult.data.approvalChannelId : null;
  const isAdmin = isAdminUser(interaction, managerRoleId);

  // 일반 유저인데 승인 채널이 없으면 생성 불가
  if (!isAdmin && !approvalChannelId) {
    await interaction.reply({
      content: '❌ 내전 생성 권한이 없습니다.\n관리자가 승인 채널을 설정하면 일반 유저도 내전을 요청할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const userId = interaction.user.id;
  const uniqueId = `${userId}_${Date.now()}`;

  // 직접 입력 모달 표시 (5개 필드)
  const modal = new ModalBuilder()
    .setCustomId(`game_create_modal_${uniqueId}`)
    .setTitle('🎮 새 내전 생성');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('제목')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 발로란트 내전 1차')
    .setMaxLength(200)
    .setRequired(true);

  const teamCountInput = new TextInputBuilder()
    .setCustomId('team_count')
    .setLabel('팀 수')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 2 (최대 100)')
    .setValue('2')
    .setMaxLength(3)
    .setRequired(true);

  const maxPlayersInput = new TextInputBuilder()
    .setCustomId('max_players')
    .setLabel('팀당 인원 (선택사항, 비워두면 무제한)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 5')
    .setMaxLength(3)
    .setRequired(false);

  const rewardsInput = new TextInputBuilder()
    .setCustomId('rewards')
    .setLabel('순위보상 (선택사항, 비율로 입력)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 3,2,1 또는 승자독식')
    .setMaxLength(50)
    .setRequired(false);

  const entryFeeInput = new TextInputBuilder()
    .setCustomId('entry_fee')
    .setLabel('참가비 (선택사항, 비워두면 기본값)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 1000')
    .setMaxLength(15)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(teamCountInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(maxPlayersInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(rewardsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(entryFeeInput)
  );

  await interaction.showModal(modal);
}

/**
 * 내전 패널 - 카테고리 선택 버튼
 */
export async function handleGamePanelCategory(
  interaction: ButtonInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 설정 조회
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;
  const approvalChannelId = settingsResult.success ? settingsResult.data.approvalChannelId : null;
  const isAdmin = isAdminUser(interaction, managerRoleId);

  // 일반 유저인데 승인 채널이 없으면 생성 불가
  if (!isAdmin && !approvalChannelId) {
    await interaction.reply({
      content: '❌ 내전 생성 권한이 없습니다.\n관리자가 승인 채널을 설정하면 일반 유저도 내전을 요청할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 카테고리 조회
  const categoriesResult = await container.gameService.getEnabledCategories(guildId);
  const categories = categoriesResult.success ? categoriesResult.data : [];

  const userId = interaction.user.id;
  const uniqueId = `${userId}_${Date.now()}`;

  if (categories.length > 0) {
    // 카테고리가 있으면 선택 메뉴 표시
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`game_create_category_${uniqueId}`)
      .setPlaceholder('카테고리를 선택하세요')
      .addOptions(
        categories.map(cat => ({
          label: cat.name,
          value: cat.id.toString(),
          description: `${cat.teamCount}팀`,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '🎮 내전 카테고리를 선택하세요:',
      components: [row],
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
  } else {
    // 카테고리가 없으면 안내 메시지
    await interaction.reply({
      content: '⚠️ 등록된 카테고리가 없습니다.\n웹 대시보드에서 카테고리를 먼저 생성해주세요.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
  }
}

/**
 * 카테고리 선택 후 제목 입력 모달
 */
export async function handleGameCategorySelect(
  interaction: StringSelectMenuInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  // 선택된 카테고리 ID
  const categoryId = parseInt(interaction.values[0]!, 10);

  const userId = interaction.user.id;
  const uniqueId = `${userId}_${Date.now()}`;

  const modal = new ModalBuilder()
    .setCustomId(`game_create_modal_cat_${categoryId}_${uniqueId}`)
    .setTitle('🎮 새 내전 생성');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('제목')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 발로란트 내전 1차')
    .setMaxLength(200)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput)
  );

  await interaction.showModal(modal);
}

/**
 * 순위보상 문자열 파싱 (비율 기반)
 * @param rewardsRaw 사용자 입력 (예: "3,2,1" 또는 "승자독식")
 * @returns { customRankRewards, customWinnerTakesAll, error }
 */
function parseRewardsInput(rewardsRaw: string): {
  customRankRewards: RankRewards | null;
  customWinnerTakesAll: boolean | null;
  error: string | null;
} {
  const trimmed = rewardsRaw.trim().toLowerCase();

  if (!trimmed) {
    return { customRankRewards: null, customWinnerTakesAll: null, error: null };
  }

  // 승자독식 체크
  if (trimmed === '승자독식' || trimmed === 'winner' || trimmed === '독식') {
    return { customRankRewards: null, customWinnerTakesAll: true, error: null };
  }

  // 비율 파싱 (예: "3,2,1" 또는 "50,30,15,5")
  const parts = trimmed.split(',').map(s => parseInt(s.trim()));

  if (parts.some(isNaN) || parts.length === 0) {
    return {
      customRankRewards: null,
      customWinnerTakesAll: null,
      error: '순위보상 형식이 올바르지 않습니다.\n예: `3,2,1` 또는 `승자독식`',
    };
  }

  if (parts.some(p => p < 0)) {
    return {
      customRankRewards: null,
      customWinnerTakesAll: null,
      error: '순위보상은 0 이상이어야 합니다.',
    };
  }

  // 비율로 저장 (finishGame에서 자동 정규화됨)
  const customRankRewards: RankRewards = {};
  parts.forEach((ratio, index) => {
    customRankRewards[index + 1] = ratio;
  });

  return { customRankRewards, customWinnerTakesAll: null, error: null };
}

/**
 * 승인 요청 메시지 생성
 */
function createApprovalRequestContainer(
  game: Game,
  topyName: string,
  rankRewards?: Record<number, number>
): APIContainerComponent {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 📋 내전 생성 요청')
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  let infoText = `**제목**: ${game.title}\n`;
  infoText += `**요청자**: <@${game.createdBy}>\n`;
  infoText += `**팀 수**: ${game.teamCount}팀\n`;
  if (game.maxPlayersPerTeam) {
    infoText += `**팀당 인원**: ${game.maxPlayersPerTeam}명\n`;
  }
  infoText += `**참가비**: ${game.entryFee.toLocaleString()} ${topyName}\n`;

  // 순위 보상 표시
  if (game.customWinnerTakesAll) {
    infoText += `**순위 보상**: 🏆 승자 독식 (1등 100%)`;
  } else if (game.customRankRewards) {
    const total = Object.values(game.customRankRewards).reduce((a, b) => a + b, 0);
    const rewardEntries = Object.entries(game.customRankRewards)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([rank, ratio]) => {
        const percent = total > 0 ? Math.round((ratio / total) * 100) : 0;
        return `${rank}등: ${percent}%`;
      })
      .join(' | ');
    infoText += `**순위 보상**: ${rewardEntries}`;
  } else if (rankRewards) {
    const total = Object.values(rankRewards).reduce((a, b) => a + b, 0);
    const rewardEntries = Object.entries(rankRewards)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .filter(([, ratio]) => ratio > 0)
      .map(([rank, ratio]) => {
        const percent = total > 0 ? Math.round((ratio / total) * 100) : 0;
        return `${rank}등: ${percent}%`;
      })
      .join(' | ');
    infoText += `**순위 보상**: ${rewardEntries}`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(infoText)
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('⚠️ 관리자 판단하에 조정이 될 수 있습니다.')
  );

  return container.toJSON();
}

/**
 * 승인 요청 메시지 버튼 생성
 */
function createApprovalButtons(gameId: bigint): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`game_approve_${gameId}`)
        .setLabel('승인')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`game_adjust_${gameId}`)
        .setLabel('조정')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`game_reject_${gameId}`)
        .setLabel('거절')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    ),
  ];
}

/**
 * 내전 생성 모달 제출 핸들러
 */
export async function handleGameCreateModal(
  interaction: ModalSubmitInteraction,
  container: Container,
  categoryId?: number
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  if (!guildId || !channelId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue('title');

  let teamCount = 2;
  let selectedCategoryId: number | undefined = categoryId;
  let maxPlayersPerTeam: number | null = null;
  let customRankRewards: RankRewards | null = null;
  let customWinnerTakesAll: boolean | null = null;
  let customEntryFee: bigint | null = null;

  if (categoryId) {
    // 카테고리에서 설정 가져오기
    const categoriesResult = await container.gameService.getCategories(guildId);
    if (categoriesResult.success) {
      const category = categoriesResult.data.find(c => c.id === categoryId);
      if (category) {
        teamCount = category.teamCount;
        selectedCategoryId = category.id;
        maxPlayersPerTeam = category.maxPlayersPerTeam;
        customWinnerTakesAll = category.winnerTakesAll || null;
        customRankRewards = category.rankRewards;
      }
    }
  } else {
    // 직접 입력한 값들 파싱
    const teamCountStr = interaction.fields.getTextInputValue('team_count');
    teamCount = parseInt(teamCountStr) || 2;
    if (teamCount < 2) teamCount = 2;
    if (teamCount > 100) teamCount = 100;

    // 팀당 인원 파싱
    try {
      const maxPlayersRaw = interaction.fields.getTextInputValue('max_players');
      if (maxPlayersRaw.trim()) {
        const parsed = parseInt(maxPlayersRaw.trim());
        if (!isNaN(parsed) && parsed > 0) {
          maxPlayersPerTeam = parsed;
        }
      }
    } catch {
      // 필드가 없을 수 있음 (카테고리 선택 시)
    }

    // 순위보상 파싱
    try {
      const rewardsRaw = interaction.fields.getTextInputValue('rewards');
      const parsed = parseRewardsInput(rewardsRaw);
      if (parsed.error) {
        await interaction.editReply({ content: `❌ ${parsed.error}` });
        scheduleEphemeralDelete(interaction);
        return;
      }
      customRankRewards = parsed.customRankRewards;
      customWinnerTakesAll = parsed.customWinnerTakesAll;
    } catch {
      // 필드가 없을 수 있음
    }

    // 참가비 파싱
    try {
      const entryFeeRaw = interaction.fields.getTextInputValue('entry_fee');
      if (entryFeeRaw.trim()) {
        const parsed = parseInt(entryFeeRaw.trim());
        if (!isNaN(parsed) && parsed >= 0) {
          customEntryFee = BigInt(parsed);
        }
      }
    } catch {
      // 필드가 없을 수 있음
    }
  }

  // 설정 조회
  const settingsResult = await container.gameService.getSettings(guildId);
  const defaultEntryFee = settingsResult.success ? settingsResult.data.entryFee : BigInt(100);
  const defaultRankRewards = settingsResult.success
    ? settingsResult.data.rankRewards
    : { 1: 50, 2: 30, 3: 15, 4: 5 };
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;
  const approvalChannelId = settingsResult.success ? settingsResult.data.approvalChannelId : null;

  // 관리자 여부 확인 (멤버 정보에서)
  let isAdmin = false;
  if (interaction.member) {
    const memberPermissions = interaction.memberPermissions;
    if (memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      isAdmin = true;
    } else if (managerRoleId && interaction.member.roles) {
      const memberRoles = interaction.member.roles;
      if (Array.isArray(memberRoles)) {
        isAdmin = memberRoles.includes(managerRoleId);
      } else if ('cache' in memberRoles) {
        isAdmin = memberRoles.cache.has(managerRoleId);
      }
    }
  }

  // 실제 적용될 참가비
  const actualEntryFee = customEntryFee ?? defaultEntryFee;

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 게임 생성
  const createResult = await container.gameService.createGame({
    guildId,
    channelId,
    categoryId: selectedCategoryId,
    title,
    teamCount,
    entryFee: defaultEntryFee, // 기본값 전달 (서비스에서 customEntryFee 우선 적용)
    createdBy: userId,
    maxPlayersPerTeam,
    customRankRewards,
    customWinnerTakesAll,
    customEntryFee,
  });

  if (!createResult.success) {
    await interaction.editReply({ content: '❌ 내전 생성에 실패했습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = createResult.data;

  // Embed에 표시할 순위보상 결정
  let displayRankRewards = defaultRankRewards;
  if (customRankRewards) {
    displayRankRewards = customRankRewards;
  } else if (customWinnerTakesAll) {
    displayRankRewards = { 1: 100, 2: 0 };
  }

  // 관리자인 경우: 바로 게임 패널 생성
  if (isAdmin) {
    // 채널에 내전 메시지 전송
    const channel = interaction.channel as TextChannel;
    const gameContainer = createGameContainer(game, topyName, [], displayRankRewards);
    const buttons = createGameButtons(game, true);

    const message = await channel.send({
      components: [gameContainer, ...buttons],
      flags: MessageFlags.IsComponentsV2,
    });

    // 메시지 ID 저장
    await container.gameService.updateGameMessageId(game.id, message.id);

    // 응답 메시지 생성
    let replyContent = `✅ 내전이 생성되었습니다!\n\n**${title}**\n팀 수: ${teamCount}팀\n참가비: ${actualEntryFee.toLocaleString()} ${topyName}`;
    if (maxPlayersPerTeam) {
      replyContent += `\n팀당 인원: ${maxPlayersPerTeam}명`;
    }
    if (customWinnerTakesAll) {
      replyContent += `\n보상: 🏆 승자 독식`;
    } else if (customRankRewards) {
      const rewardText = Object.entries(customRankRewards)
        .map(([rank, ratio]) => `${rank}등: ${ratio}`)
        .join(', ');
      replyContent += `\n보상 비율: ${rewardText}`;
    }

    await interaction.editReply({ content: replyContent });
    scheduleEphemeralDelete(interaction);
  } else {
    // 일반 유저: 승인 대기 상태로 생성
    if (!approvalChannelId) {
      // 승인 채널이 없으면 게임 삭제 후 오류
      await container.gameService.rejectGame(game.id);
      await interaction.editReply({
        content: '❌ 승인 채널이 설정되지 않아 내전을 요청할 수 없습니다.\n관리자에게 문의해주세요.',
      });
      scheduleEphemeralDelete(interaction);
      return;
    }

    // 게임을 pending_approval 상태로 변경
    await container.gameService.updateGameStatus(game.id, 'pending_approval');

    // 승인 채널에 승인 요청 메시지 전송
    try {
      const approvalChannel = await interaction.client.channels.fetch(approvalChannelId) as TextChannel;
      if (approvalChannel) {
        const approvalContainer = createApprovalRequestContainer(game, topyName, displayRankRewards);
        const approvalButtons = createApprovalButtons(game.id);

        await approvalChannel.send({
          components: [approvalContainer, ...approvalButtons],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    } catch (err) {
      console.error('[GAME] Failed to send approval request:', err);
      // 승인 채널 전송 실패해도 게임은 생성됨
    }

    // 응답 메시지 생성
    let replyContent = `📋 내전 생성 요청이 제출되었습니다!\n\n**${title}**\n팀 수: ${teamCount}팀\n참가비: ${actualEntryFee.toLocaleString()} ${topyName}`;
    if (maxPlayersPerTeam) {
      replyContent += `\n팀당 인원: ${maxPlayersPerTeam}명`;
    }
    replyContent += `\n\n⏳ 관리자 승인을 기다리고 있습니다.\n승인되면 내전 패널이 생성됩니다.`;

    await interaction.editReply({ content: replyContent });
    scheduleEphemeralDelete(interaction);
  }
}

// ============================================================
// 참가 핸들러
// ============================================================

/**
 * 참가하기 버튼 핸들러
 */
export async function handleGameJoin(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 참가
  const joinResult = await container.gameService.joinGame(guildId, gameId, userId);

  if (!joinResult.success) {
    let errorMessage = '참가에 실패했습니다.';

    switch (joinResult.error.type) {
      case 'GAME_NOT_FOUND':
        errorMessage = '게임을 찾을 수 없습니다.';
        break;
      case 'GAME_NOT_OPEN':
        errorMessage = '모집이 마감되었습니다.';
        break;
      case 'ALREADY_JOINED':
        errorMessage = '이미 참가하셨습니다.';
        break;
      case 'INSUFFICIENT_BALANCE':
        errorMessage = `잔액이 부족합니다.\n필요: ${joinResult.error.required.toLocaleString()} ${topyName}\n보유: ${joinResult.error.available.toLocaleString()} ${topyName}`;
        break;
      case 'GAME_FULL':
        errorMessage = `정원이 가득 찼습니다. (${joinResult.error.currentPlayers}/${joinResult.error.maxPlayers}명)`;
        break;
    }

    await interaction.editReply({ content: `❌ ${errorMessage}` });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 정보 다시 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.editReply({ content: '✅ 참가 완료!' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;

  // 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const participantsResult = await container.gameService.getParticipants(gameId);
      const participants = participantsResult.success ? participantsResult.data : [];

      const settingsResult = await container.gameService.getSettings(guildId);
      const rankRewards = settingsResult.success
        ? settingsResult.data.rankRewards
        : undefined;

      const gameContainer = createGameContainer(game, topyName, participants, rankRewards);
      const buttons = createGameButtons(game, true);
      await message.edit({
        components: [gameContainer, ...buttons],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
      });
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  await interaction.editReply({
    content: `✅ **${game.title}**에 참가했습니다!\n참가비 ${game.entryFee.toLocaleString()} ${topyName}가 차감되었습니다.`,
  });
  scheduleEphemeralDelete(interaction);
}

/**
 * 참가 취소 버튼 핸들러
 */
export async function handleGameLeave(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 참가 취소
  const leaveResult = await container.gameService.leaveGame(guildId, gameId, userId);

  if (!leaveResult.success) {
    let errorMessage = '참가 취소에 실패했습니다.';

    switch (leaveResult.error.type) {
      case 'GAME_NOT_FOUND':
        errorMessage = '게임을 찾을 수 없습니다.';
        break;
      case 'GAME_NOT_OPEN':
        errorMessage = '모집이 마감되어 취소할 수 없습니다.';
        break;
      case 'NOT_PARTICIPANT':
        errorMessage = '참가하지 않은 게임입니다.';
        break;
    }

    await interaction.editReply({ content: `❌ ${errorMessage}` });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 정보 다시 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.editReply({ content: '✅ 참가가 취소되었습니다. 참가비가 환불되었습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;

  // 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const participantsResult = await container.gameService.getParticipants(gameId);
      const participants = participantsResult.success ? participantsResult.data : [];

      const settingsResult = await container.gameService.getSettings(guildId);
      const rankRewards = settingsResult.success
        ? settingsResult.data.rankRewards
        : undefined;

      const gameContainer = createGameContainer(game, topyName, participants, rankRewards);
      const buttons = createGameButtons(game, true);
      await message.edit({
        components: [gameContainer, ...buttons],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
      });
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  await interaction.editReply({
    content: `✅ 참가가 취소되었습니다.\n참가비 ${game.entryFee.toLocaleString()} ${topyName}가 환불되었습니다.`,
  });
  scheduleEphemeralDelete(interaction);
}

// ============================================================
// 참가자 자기 팀 이동 핸들러
// ============================================================

/**
 * 참가자 자기 팀 이동 버튼 핸들러
 */
export async function handleGameTeamSelf(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint,
  teamNumber: number
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const userId = interaction.user.id;

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;

  // 상태 체크 (open 또는 team_assign만 허용)
  if (game.status !== 'open' && game.status !== 'team_assign') {
    await interaction.reply({
      content: '❌ 현재 팀 이동이 불가능한 상태입니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 참가자인지 확인
  const participantsResult = await container.gameService.getParticipants(gameId);
  const participants = participantsResult.success ? participantsResult.data : [];
  const participant = participants.find(p => p.userId === userId);

  if (!participant) {
    await interaction.reply({
      content: '❌ 먼저 내전에 참가해야 합니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 이미 해당 팀에 배정되어 있는지 확인
  if (participant.teamNumber === teamNumber) {
    await interaction.reply({
      content: `✅ 이미 ${teamNumber}팀에 배정되어 있습니다.`,
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 팀 정원 체크
  if (game.maxPlayersPerTeam !== null) {
    const currentTeamCount = participants.filter(p => p.teamNumber === teamNumber).length;
    if (currentTeamCount >= game.maxPlayersPerTeam) {
      await interaction.reply({
        content: `❌ ${teamNumber}팀 정원이 다 찼습니다. (${currentTeamCount}/${game.maxPlayersPerTeam}명)`,
        ephemeral: true,
      });
      scheduleEphemeralDelete(interaction);
      return;
    }
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 팀 배정
  const assignResult = await container.gameService.assignTeam(gameId, teamNumber, [userId]);

  if (!assignResult.success) {
    await interaction.editReply({ content: '❌ 팀 배정에 실패했습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 상태가 open이면 team_assign으로 변경할 필요가 있음 (선택적)
  // 현재 서비스에서는 assignTeam 호출 시 자동으로 처리될 수 있음

  // 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const updatedGameResult = await container.gameService.getGameById(gameId);
      const updatedGame = updatedGameResult.success ? updatedGameResult.data : game;
      const updatedParticipantsResult = await container.gameService.getParticipants(gameId);
      const updatedParticipants = updatedParticipantsResult.success ? updatedParticipantsResult.data : [];

      const settingsResult = await container.gameService.getSettings(guildId);
      const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;
      const rankRewards = settingsResult.success ? settingsResult.data.rankRewards : undefined;

      // 방장 또는 관리자 여부 확인
      const isAdmin = isAdminOrCreator(interaction, managerRoleId, updatedGame);

      const gameContainer = createGameContainer(updatedGame, topyName, updatedParticipants, rankRewards);
      const buttons = createGameButtons(updatedGame, isAdmin);
      await message.edit({
        components: [gameContainer, ...buttons],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
      });
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  const prevTeamText = participant.teamNumber ? `${participant.teamNumber}팀` : '미배정';
  await interaction.editReply({
    content: `✅ ${prevTeamText} → **${teamNumber}팀**으로 이동했습니다!`,
  });
  scheduleEphemeralDelete(interaction);
}

// ============================================================
// 팀 배정 핸들러
// ============================================================

/**
 * 팀 배정 버튼 핸들러
 */
export async function handleGameTeamAssign(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;
  const userId = interaction.user.id;

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, game)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 팀을 배정할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 참가자 목록 조회하여 팀별 현황 파악
  const participantsResult = await container.gameService.getParticipants(gameId);
  const participants = participantsResult.success ? participantsResult.data : [];

  // 팀별 멤버 분류
  const teamMembers: Record<number, string[]> = {};
  const unassignedMembers: string[] = [];
  for (const p of participants) {
    if (p.teamNumber === null) {
      unassignedMembers.push(p.userId);
    } else {
      if (!teamMembers[p.teamNumber]) {
        teamMembers[p.teamNumber] = [];
      }
      teamMembers[p.teamNumber]!.push(p.userId);
    }
  }

  // Discord 멤버 이름 조회
  const allUserIds = participants.map(p => p.userId);
  const userNames: Record<string, string> = {};
  try {
    const guild = interaction.guild;
    if (guild) {
      for (const odminUserId of allUserIds) {
        try {
          const member = await guild.members.fetch(odminUserId);
          userNames[odminUserId] = member.displayName || member.user.username;
        } catch {
          userNames[odminUserId] = `유저(${odminUserId.slice(-4)})`;
        }
      }
    }
  } catch {
    // 멤버 조회 실패해도 계속 진행
  }

  // 팀 버튼 생성
  const teamButtons: ButtonBuilder[] = [];
  for (let i = 1; i <= game.teamCount; i++) {
    const currentCount = teamMembers[i]?.length || 0;
    const maxDisplay = game.maxPlayersPerTeam ? `/${game.maxPlayersPerTeam}` : '';
    teamButtons.push(
      new ButtonBuilder()
        .setCustomId(`game_team_edit_${gameId}_${i}`)
        .setLabel(`${i}팀 (${currentCount}${maxDisplay}명)`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(getTeamEmoji(i))
    );
  }

  // 팀 해제 버튼
  const removeButton = new ButtonBuilder()
    .setCustomId(`game_team_remove_${gameId}`)
    .setLabel('팀 해제')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🔓');

  // 버튼 행 구성 (최대 5개씩)
  const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
  const allButtons = [...teamButtons];

  for (let i = 0; i < allButtons.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      allButtons.slice(i, i + 5)
    );
    buttonRows.push(row);
  }

  // 팀 해제 버튼은 별도 행에
  const removeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(removeButton);

  // Components V2 Container 생성
  const uiContainer = new ContainerBuilder();

  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🎲 팀 배정')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('편집할 팀을 선택하거나, 팀 해제로 배정을 취소하세요')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 팀 배정 현황 텍스트 생성
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**📊 현재 팀 배정 현황**')
  );

  for (let i = 1; i <= game.teamCount; i++) {
    const members = teamMembers[i] || [];
    const maxDisplay = game.maxPlayersPerTeam ? `/${game.maxPlayersPerTeam}` : '';
    let teamText = `${getTeamEmoji(i)} **${i}팀** (${members.length}${maxDisplay}명)`;
    if (members.length > 0) {
      const memberNames = members.map(id => userNames[id] || `유저(${id.slice(-4)})`);
      teamText += `\n-# ${memberNames.join(', ')}`;
    }
    uiContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(teamText)
    );
  }

  // 미배정 멤버
  let unassignedText = `\n⏳ **미배정**: ${unassignedMembers.length}명`;
  if (unassignedMembers.length > 0) {
    const unassignedNames = unassignedMembers.map(id => userNames[id] || `유저(${id.slice(-4)})`);
    unassignedText += `\n-# ${unassignedNames.join(', ')}`;
  }
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(unassignedText)
  );

  await interaction.reply({
    components: [uiContainer.toJSON(), ...buttonRows.map(r => r.toJSON()), removeRow.toJSON()],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  scheduleEphemeralDelete(interaction, LONG_DELETE_DELAY);
}

/**
 * 팀 선택 후 유저 선택 핸들러
 */
export async function handleGameTeamSelect(
  interaction: StringSelectMenuInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.update({ content: '서버에서만 사용할 수 있습니다.', components: [] });
    return;
  }

  // customId: game_team_select_{gameId}_{userId}
  const parts = interaction.customId.split('_');
  const gameId = BigInt(parts[3]!);

  // 선택된 팀 번호
  const teamNumber = parseInt(interaction.values[0]!, 10);

  const odminUserId = interaction.user.id;

  // 게임 정보 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.update({ content: '❌ 게임을 찾을 수 없습니다.', components: [] });
    return;
  }
  const game = gameResult.data;

  // 참가자 목록 조회 (아직 팀 배정 안 된 사람만)
  const participantsResult = await container.gameService.getParticipants(gameId);
  if (!participantsResult.success) {
    await interaction.update({ content: '❌ 참가자 목록을 불러올 수 없습니다.', components: [] });
    return;
  }

  const participants = participantsResult.data;
  const unassignedParticipants = participants.filter(p => p.teamNumber === null);

  // 팀별 멤버 분류
  const teamMembers: Record<number, string[]> = {};
  for (const p of participants) {
    if (p.teamNumber !== null) {
      if (!teamMembers[p.teamNumber]) {
        teamMembers[p.teamNumber] = [];
      }
      teamMembers[p.teamNumber]!.push(p.userId);
    }
  }

  if (unassignedParticipants.length === 0) {
    await interaction.update({ content: '✅ 모든 참가자가 이미 팀에 배정되었습니다.', components: [] });
    return;
  }

  // Discord에서 유저 이름을 가져오기 위해 멤버 조회 (전체 참가자)
  const allUserIds = participants.map(p => p.userId);
  const userNames: Record<string, string> = {};
  try {
    const guild = interaction.guild;
    if (guild) {
      for (const odminId of allUserIds) {
        try {
          const member = await guild.members.fetch(odminId);
          userNames[odminId] = member.displayName || member.user.username;
        } catch {
          userNames[odminId] = `유저(${odminId.slice(-4)})`;
        }
      }
    }
  } catch {
    // 멤버 조회 실패해도 계속 진행
  }

  // 참가자 선택 메뉴 (StringSelectMenuBuilder로 참가자만 표시)
  const participantOptions = unassignedParticipants.slice(0, 25).map(p => ({
    label: userNames[p.userId] || `유저(${p.userId.slice(-4)})`,
    value: p.userId,
    description: `@${userNames[p.userId] || p.userId.slice(-4)}`,
  }))

  const userSelect = new StringSelectMenuBuilder()
    .setCustomId(`game_team_users_${gameId}_${teamNumber}_${odminUserId}`)
    .setPlaceholder('팀원을 선택하세요 (참가자만 표시)')
    .setMinValues(1)
    .setMaxValues(Math.min(unassignedParticipants.length, 25))
    .addOptions(participantOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(userSelect);

  // Components V2 Container 생성
  const uiContainer = new ContainerBuilder();

  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${getTeamEmoji(teamNumber)} ${teamNumber}팀 팀원 선택`)
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('팀에 배정할 멤버를 선택하세요')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 팀 배정 현황 텍스트 생성
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**📊 현재 팀 배정 현황**')
  );

  for (let i = 1; i <= game.teamCount; i++) {
    const members = teamMembers[i] || [];
    const maxDisplay = game.maxPlayersPerTeam ? `/${game.maxPlayersPerTeam}` : '';
    const isSelected = i === teamNumber ? ' ◀' : '';
    let teamText = `${getTeamEmoji(i)} **${i}팀** (${members.length}${maxDisplay}명)${isSelected}`;
    if (members.length > 0) {
      const memberNames = members.map(id => userNames[id] || `유저(${id.slice(-4)})`);
      teamText += `\n-# ${memberNames.join(', ')}`;
    }
    uiContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(teamText)
    );
  }

  // 미배정 멤버
  let unassignedText = `\n⏳ **미배정**: ${unassignedParticipants.length}명`;
  if (unassignedParticipants.length > 0) {
    const unassignedNames = unassignedParticipants.map(p => userNames[p.userId] || `유저(${p.userId.slice(-4)})`);
    unassignedText += `\n-# ${unassignedNames.join(', ')}`;
  }
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(unassignedText)
  );

  await interaction.update({
    components: [uiContainer.toJSON(), selectRow.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * 팀 편집 버튼 핸들러 (버튼 방식)
 */
export async function handleGameTeamEdit(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint,
  teamNumber: number
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 정보 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }
  const game = gameResult.data;

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, game)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 팀을 편집할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 참가자 목록 조회
  const participantsResult = await container.gameService.getParticipants(gameId);
  if (!participantsResult.success) {
    await interaction.reply({ content: '❌ 참가자 목록을 불러올 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const participants = participantsResult.data;

  // 해당 팀에 속하지 않은 참가자만 선택 가능 (미배정 + 다른 팀)
  const selectableParticipants = participants.filter(p => p.teamNumber !== teamNumber);

  if (selectableParticipants.length === 0) {
    await interaction.reply({
      content: '✅ 모든 참가자가 이미 이 팀에 배정되었습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 팀별 멤버 분류
  const teamMembers: Record<number, string[]> = {};
  const unassignedMembers: string[] = [];
  for (const p of participants) {
    if (p.teamNumber === null) {
      unassignedMembers.push(p.userId);
    } else {
      if (!teamMembers[p.teamNumber]) {
        teamMembers[p.teamNumber] = [];
      }
      teamMembers[p.teamNumber]!.push(p.userId);
    }
  }

  // Discord에서 유저 이름을 가져오기 위해 멤버 조회
  const allUserIds = participants.map(p => p.userId);
  const userNames: Record<string, string> = {};
  try {
    const guild = interaction.guild;
    if (guild) {
      for (const odminId of allUserIds) {
        try {
          const member = await guild.members.fetch(odminId);
          userNames[odminId] = member.displayName || member.user.username;
        } catch {
          userNames[odminId] = `유저(${odminId.slice(-4)})`;
        }
      }
    }
  } catch {
    // 멤버 조회 실패해도 계속 진행
  }

  const odminUserId = interaction.user.id;

  // 참가자 선택 메뉴 (현재 팀 표시)
  const participantOptions = selectableParticipants.slice(0, 25).map(p => {
    const teamLabel = p.teamNumber === null ? '미배정' : `${p.teamNumber}팀`;
    return {
      label: userNames[p.userId] || `유저(${p.userId.slice(-4)})`,
      value: p.userId,
      description: `현재: ${teamLabel}`,
    };
  });

  const userSelect = new StringSelectMenuBuilder()
    .setCustomId(`game_team_users_${gameId}_${teamNumber}_${odminUserId}`)
    .setPlaceholder('팀에 추가할 멤버를 선택하세요')
    .setMinValues(1)
    .setMaxValues(Math.min(selectableParticipants.length, 25))
    .addOptions(participantOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(userSelect);

  // Components V2 Container 생성
  const uiContainer = new ContainerBuilder();

  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${getTeamEmoji(teamNumber)} ${teamNumber}팀 편집`)
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('팀에 추가할 멤버를 선택하세요\n-# 다른 팀에서 이동하거나 미배정 멤버를 추가할 수 있습니다')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 팀 배정 현황 텍스트 생성
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**📊 현재 팀 배정 현황**')
  );

  for (let i = 1; i <= game.teamCount; i++) {
    const members = teamMembers[i] || [];
    const maxDisplay = game.maxPlayersPerTeam ? `/${game.maxPlayersPerTeam}` : '';
    const isSelected = i === teamNumber ? ' ◀' : '';
    let teamText = `${getTeamEmoji(i)} **${i}팀** (${members.length}${maxDisplay}명)${isSelected}`;
    if (members.length > 0) {
      const memberNames = members.map(id => userNames[id] || `유저(${id.slice(-4)})`);
      teamText += `\n-# ${memberNames.join(', ')}`;
    }
    uiContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(teamText)
    );
  }

  // 미배정 멤버
  let unassignedText = `\n⏳ **미배정**: ${unassignedMembers.length}명`;
  if (unassignedMembers.length > 0) {
    const unassignedNames = unassignedMembers.map(id => userNames[id] || `유저(${id.slice(-4)})`);
    unassignedText += `\n-# ${unassignedNames.join(', ')}`;
  }
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(unassignedText)
  );

  await interaction.reply({
    components: [uiContainer.toJSON(), selectRow.toJSON()],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  scheduleEphemeralDelete(interaction, LONG_DELETE_DELAY);
}

/**
 * 팀 해제 버튼 핸들러
 */
export async function handleGameTeamRemove(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 정보 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }
  const game = gameResult.data;

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, game)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 팀 배정을 해제할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 참가자 목록 조회
  const participantsResult = await container.gameService.getParticipants(gameId);
  if (!participantsResult.success) {
    await interaction.reply({ content: '❌ 참가자 목록을 불러올 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const participants = participantsResult.data;

  // 팀에 배정된 참가자만 선택 가능
  const assignedParticipants = participants.filter(p => p.teamNumber !== null);

  if (assignedParticipants.length === 0) {
    await interaction.reply({
      content: '❌ 팀에 배정된 참가자가 없습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 팀별 멤버 분류
  const teamMembers: Record<number, string[]> = {};
  for (const p of participants) {
    if (p.teamNumber !== null) {
      if (!teamMembers[p.teamNumber]) {
        teamMembers[p.teamNumber] = [];
      }
      teamMembers[p.teamNumber]!.push(p.userId);
    }
  }

  // Discord에서 유저 이름을 가져오기 위해 멤버 조회
  const allUserIds = participants.map(p => p.userId);
  const userNames: Record<string, string> = {};
  try {
    const guild = interaction.guild;
    if (guild) {
      for (const odminId of allUserIds) {
        try {
          const member = await guild.members.fetch(odminId);
          userNames[odminId] = member.displayName || member.user.username;
        } catch {
          userNames[odminId] = `유저(${odminId.slice(-4)})`;
        }
      }
    }
  } catch {
    // 멤버 조회 실패해도 계속 진행
  }

  const odminUserId = interaction.user.id;

  // 참가자 선택 메뉴 (현재 팀 표시)
  const participantOptions = assignedParticipants.slice(0, 25).map(p => ({
    label: userNames[p.userId] || `유저(${p.userId.slice(-4)})`,
    value: p.userId,
    description: `현재: ${p.teamNumber}팀`,
  }));

  const userSelect = new StringSelectMenuBuilder()
    .setCustomId(`game_team_unassign_${gameId}_${odminUserId}`)
    .setPlaceholder('팀에서 해제할 멤버를 선택하세요')
    .setMinValues(1)
    .setMaxValues(Math.min(assignedParticipants.length, 25))
    .addOptions(participantOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(userSelect);

  // Components V2 Container 생성
  const uiContainer = new ContainerBuilder();

  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🔓 팀 해제')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('팀에서 해제할 멤버를 선택하세요\n-# 선택한 멤버는 미배정 상태로 변경됩니다')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // 팀 배정 현황 텍스트 생성
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**📊 현재 팀 배정 현황**')
  );

  for (let i = 1; i <= game.teamCount; i++) {
    const members = teamMembers[i] || [];
    const maxDisplay = game.maxPlayersPerTeam ? `/${game.maxPlayersPerTeam}` : '';
    let teamText = `${getTeamEmoji(i)} **${i}팀** (${members.length}${maxDisplay}명)`;
    if (members.length > 0) {
      const memberNames = members.map(id => userNames[id] || `유저(${id.slice(-4)})`);
      teamText += `\n-# ${memberNames.join(', ')}`;
    }
    uiContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(teamText)
    );
  }

  await interaction.reply({
    components: [uiContainer.toJSON(), selectRow.toJSON()],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  scheduleEphemeralDelete(interaction, LONG_DELETE_DELAY);
}

/**
 * 팀 해제 선택 완료 핸들러
 */
export async function handleGameTeamUnassign(
  interaction: StringSelectMenuInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('❌ 서버에서만 사용할 수 있습니다.')
    );
    await interaction.update({ components: [errorContainer.toJSON()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // customId: game_team_unassign_{gameId}_{userId}
  const parts = interaction.customId.split('_');
  const gameId = BigInt(parts[3]!);

  const selectedUserIds = interaction.values;

  // 팀 해제 실행
  const unassignResult = await container.gameService.unassignTeam(gameId, selectedUserIds);

  if (!unassignResult.success) {
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ❌ 팀 해제 실패')
    );
    errorContainer.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('팀 해제 처리 중 오류가 발생했습니다.')
    );
    await interaction.update({ components: [errorContainer.toJSON()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 게임 메시지 업데이트
  const gameResult = await container.gameService.getGameById(gameId);
  if (gameResult.success) {
    const game = gameResult.data;

    try {
      if (game.messageId) {
        const channel = interaction.channel as TextChannel;
        const message = await channel.messages.fetch(game.messageId);

        const participantsResult = await container.gameService.getParticipants(gameId);
        const participants = participantsResult.success ? participantsResult.data : [];

        const gameContainer = createGameContainer(game, topyName, participants);
        const buttons = createGameButtons(game, true);
        await message.edit({
          components: [gameContainer, ...buttons],
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
        });
      }
    } catch (err) {
      console.error('[GAME] Failed to update game message:', err);
    }
  }

  const successContainer = new ContainerBuilder();
  successContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# ✅ 팀 해제 완료')
  );
  successContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  successContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${selectedUserIds.length}명의 팀 배정을 해제했습니다.`)
  );

  await interaction.update({
    components: [successContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * 유저 선택 완료 핸들러 (참가자 선택)
 */
export async function handleGameTeamUsers(
  interaction: StringSelectMenuInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('❌ 서버에서만 사용할 수 있습니다.')
    );
    await interaction.update({ components: [errorContainer.toJSON()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // customId: game_team_users_{gameId}_{teamNumber}_{userId}
  const parts = interaction.customId.split('_');
  const gameId = BigInt(parts[3]!);
  const teamNumber = parseInt(parts[4]!, 10);

  const selectedUserIds = interaction.values;

  // 팀 배정
  const assignResult = await container.gameService.assignTeam(gameId, teamNumber, selectedUserIds);

  if (!assignResult.success) {
    let errorMessage = '팀 배정에 실패했습니다.';

    if (assignResult.error.type === 'NOT_PARTICIPANT') {
      errorMessage = `<@${assignResult.error.userId}>님은 참가자가 아닙니다.`;
    } else if (assignResult.error.type === 'TEAM_FULL') {
      errorMessage = `${assignResult.error.teamNumber}팀 정원을 초과합니다. (현재 ${assignResult.error.currentPlayers}/${assignResult.error.maxPlayers}명)`;
    }

    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ❌ 팀 배정 실패')
    );
    errorContainer.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(errorMessage)
    );
    await interaction.update({ components: [errorContainer.toJSON()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 게임 메시지 업데이트
  const gameResult = await container.gameService.getGameById(gameId);
  if (gameResult.success) {
    const game = gameResult.data;

    try {
      if (game.messageId) {
        const channel = interaction.channel as TextChannel;
        const message = await channel.messages.fetch(game.messageId);

        const participantsResult = await container.gameService.getParticipants(gameId);
        const participants = participantsResult.success ? participantsResult.data : [];

        const gameContainer = createGameContainer(game, topyName, participants);
        const buttons = createGameButtons(game, true);
        await message.edit({
          components: [gameContainer, ...buttons],
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
        });
      }
    } catch (err) {
      console.error('[GAME] Failed to update game message:', err);
    }
  }

  const successContainer = new ContainerBuilder();
  successContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# ✅ 팀 배정 완료')
  );
  successContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  successContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${getTeamEmoji(teamNumber)} **${teamNumber}팀**에 ${selectedUserIds.length}명을 배정했습니다.`)
  );

  await interaction.update({
    components: [successContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * 경기 시작 버튼 핸들러
 */
export async function handleGameStart(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 조회 (권한 확인용)
  const gameCheckResult = await container.gameService.getGameById(gameId);
  if (!gameCheckResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, gameCheckResult.data)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 경기를 시작할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 경기 시작
  const startResult = await container.gameService.startGame(gameId);

  if (!startResult.success) {
    let errorMessage = '경기 시작에 실패했습니다.';

    if (startResult.error.type === 'UNASSIGNED_PARTICIPANTS') {
      errorMessage = `아직 팀이 배정되지 않은 참가자가 ${startResult.error.count}명 있습니다.`;
    }

    await interaction.editReply({ content: `❌ ${errorMessage}` });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = startResult.data;

  // 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const participantsResult = await container.gameService.getParticipants(gameId);
      const participants = participantsResult.success ? participantsResult.data : [];

      const gameContainer = createGameContainer(game, topyName, participants);
      const buttons = createGameButtons(game, true);
      await message.edit({
        components: [gameContainer, ...buttons],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
      });
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  await interaction.editReply({ content: '✅ 경기가 시작되었습니다!' });
  scheduleEphemeralDelete(interaction);
}

// ============================================================
// 강제 퇴장 핸들러
// ============================================================

/**
 * 강제 퇴장 버튼 핸들러
 */
export async function handleGameKick(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, game)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 참가자를 퇴장시킬 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 참가자 목록 조회
  const participantsResult = await container.gameService.getParticipants(gameId);
  if (!participantsResult.success || participantsResult.data.length === 0) {
    await interaction.reply({ content: '❌ 참가자가 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const participants = participantsResult.data;

  // 유저 이름 가져오기
  const guild = interaction.guild;
  const userOptions: { label: string; value: string; description?: string }[] = [];

  for (const p of participants.slice(0, 25)) {
    let displayName = p.userId;
    try {
      const member = await guild?.members.fetch(p.userId);
      if (member) {
        displayName = member.displayName;
      }
    } catch {
      // 멤버를 찾을 수 없는 경우
    }

    const teamInfo = p.teamNumber ? `${p.teamNumber}팀` : '미배정';
    userOptions.push({
      label: displayName,
      value: p.userId,
      description: teamInfo,
    });
  }

  if (userOptions.length === 0) {
    await interaction.reply({ content: '❌ 퇴장시킬 참가자가 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // Components V2 Container 생성
  const uiContainer = new ContainerBuilder();

  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# 🚪 참가자 퇴장')
  );
  uiContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  uiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('퇴장시킬 참가자를 선택하세요.\n선택된 참가자는 참가비가 환불됩니다.')
  );

  // 유저 선택 메뉴
  const userSelect = new StringSelectMenuBuilder()
    .setCustomId(`game_kick_select_${gameId}`)
    .setPlaceholder('퇴장시킬 참가자 선택...')
    .setMinValues(1)
    .setMaxValues(Math.min(userOptions.length, 25))
    .addOptions(userOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(userSelect);

  // 취소 버튼
  const cancelButton = new ButtonBuilder()
    .setCustomId(`game_kick_cancel_${gameId}`)
    .setLabel('취소')
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

  await interaction.reply({
    components: [uiContainer.toJSON(), selectRow, buttonRow],
    flags: MessageFlags.IsComponentsV2,
    ephemeral: true,
  });
}

/**
 * 강제 퇴장 유저 선택 핸들러
 */
export async function handleGameKickSelect(
  interaction: StringSelectMenuInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.update({ content: '서버에서만 사용할 수 있습니다.', components: [] });
    return;
  }

  const selectedUserIds = interaction.values;

  // 강제 퇴장 처리
  const kickResult = await container.gameService.kickParticipants(guildId, gameId, selectedUserIds);

  if (!kickResult.success) {
    const errorContainer = new ContainerBuilder();
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ❌ 퇴장 처리 실패')
    );
    errorContainer.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    errorContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('참가자 퇴장 처리 중 오류가 발생했습니다.')
    );
    await interaction.update({ components: [errorContainer.toJSON()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const { kickedCount, refundedAmount } = kickResult.data;

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 성공 메시지
  const successContainer = new ContainerBuilder();
  successContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# ✅ 퇴장 완료')
  );
  successContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  successContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${kickedCount}명을 퇴장시켰습니다.\n💰 환불 금액: ${refundedAmount.toLocaleString()} ${topyName}`
    )
  );

  await interaction.update({
    components: [successContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });

  // 게임 패널 업데이트
  try {
    const gameResult = await container.gameService.getGameById(gameId);
    if (gameResult.success) {
      const game = gameResult.data;
      if (game.messageId) {
        const channel = interaction.channel as TextChannel;
        const message = await channel.messages.fetch(game.messageId);

        const participantsResult = await container.gameService.getParticipants(gameId);
        const participants = participantsResult.success ? participantsResult.data : [];

        const gameContainer = createGameContainer(game, topyName, participants);
        const buttons = createGameButtons(game, true);
        await message.edit({
          components: [gameContainer, ...buttons],
          flags: MessageFlags.IsComponentsV2,
          embeds: [],
        });
      }
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message after kick:', err);
  }
}

/**
 * 강제 퇴장 취소 핸들러
 */
export async function handleGameKickCancel(
  interaction: ButtonInteraction
) {
  const cancelContainer = new ContainerBuilder();
  cancelContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('퇴장이 취소되었습니다.')
  );
  await interaction.update({
    components: [cancelContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ============================================================
// 결과 입력 핸들러
// ============================================================

/**
 * 결과 입력 버튼 핸들러
 */
export async function handleGameResult(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;
  const userId = interaction.user.id;

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, game)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 결과를 입력할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 팀별 순위 선택 (1등 선택)
  const teamOptions = [];
  for (let i = 1; i <= game.teamCount; i++) {
    teamOptions.push({
      label: `${i}팀`,
      value: i.toString(),
      emoji: getTeamEmoji(i),
    });
  }

  const rank1Select = new StringSelectMenuBuilder()
    .setCustomId(`game_result_rank_${gameId}_1_${userId}`)
    .setPlaceholder('🥇 1등 팀을 선택하세요')
    .addOptions(teamOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rank1Select);

  await interaction.reply({
    content: '🏆 **순위를 선택하세요**\n\n먼저 1등 팀을 선택하세요.',
    components: [row],
    ephemeral: true,
  });
}

/**
 * 순위 선택 핸들러 (1등~4등)
 * customId 형식:
 * - game_result_rank_{gameId}_1_{userId} - 1등 선택
 * - game_result_rank_{gameId}_2_{r1}_{userId} - 2등 선택
 * - game_result_rank_{gameId}_3_{r1}_{r2}_{userId} - 3등 선택
 * - game_result_rank_{gameId}_4_{r1}_{r2}_{r3}_{userId} - 4등 선택
 */
export async function handleGameResultRank(
  interaction: StringSelectMenuInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.update({ content: '서버에서만 사용할 수 있습니다.', components: [] });
    return;
  }

  const parts = interaction.customId.split('_');
  const gameId = BigInt(parts[3]!);
  const currentRank = parseInt(parts[4]!, 10);
  const selectedTeam = parseInt(interaction.values[0]!, 10);
  const userId = interaction.user.id;

  // 게임 정보 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.update({ content: '❌ 게임을 찾을 수 없습니다.', components: [] });
    return;
  }

  const game = gameResult.data;
  const teamCount = game.teamCount;

  // 이전 순위들 파싱
  const previousRanks: number[] = [];
  if (currentRank >= 2) previousRanks.push(parseInt(parts[5]!, 10)); // r1
  if (currentRank >= 3) previousRanks.push(parseInt(parts[6]!, 10)); // r2
  if (currentRank >= 4) previousRanks.push(parseInt(parts[7]!, 10)); // r3

  // 현재까지 선택된 모든 순위
  const allSelectedTeams = [...previousRanks, selectedTeam];

  // 필요한 순위 수 결정 (팀 수에 따라)
  // 2팀: 1,2등만 / 3팀: 1,2등만 / 4팀 이상: 1,2,3,4등
  const requiredRanks = teamCount >= 4 ? Math.min(4, teamCount) : 2;

  // 아직 더 선택해야 하는 경우
  if (currentRank < requiredRanks) {
    const nextRank = currentRank + 1;
    const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣'];
    const rankNames = ['1등', '2등', '3등', '4등'];

    // 다음 순위 선택 메뉴 (이미 선택된 팀 제외)
    const teamOptions = [];
    for (let i = 1; i <= teamCount; i++) {
      if (allSelectedTeams.includes(i)) continue;
      teamOptions.push({
        label: `${i}팀`,
        value: i.toString(),
        emoji: getTeamEmoji(i),
      });
    }

    // customId에 이전 순위들 인코딩
    const ranksEncoded = allSelectedTeams.join('_');
    const nextSelect = new StringSelectMenuBuilder()
      .setCustomId(`game_result_rank_${gameId}_${nextRank}_${ranksEncoded}_${userId}`)
      .setPlaceholder(`${rankEmojis[nextRank - 1]} ${rankNames[nextRank - 1]} 팀을 선택하세요`)
      .addOptions(teamOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(nextSelect);

    // 현재까지 선택된 순위 표시
    let statusText = '🏆 **순위를 선택하세요**\n\n';
    for (let i = 0; i < allSelectedTeams.length; i++) {
      const team = allSelectedTeams[i]!;
      statusText += `${rankEmojis[i]} ${rankNames[i]}: ${getTeamEmoji(team)} **${team}팀**\n`;
    }
    statusText += `\n이제 ${rankNames[nextRank - 1]} 팀을 선택하세요.`;

    await interaction.update({
      content: statusText,
      components: [row],
    });
    return;
  }

  // 모든 순위 선택 완료 → 결과 처리
  const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣'];
  const rankNames = ['1등', '2등', '3등', '4등'];

  let statusText = '⏳ 결과 처리 중...\n\n';
  for (let i = 0; i < allSelectedTeams.length; i++) {
    const team = allSelectedTeams[i]!;
    statusText += `${rankEmojis[i]} ${rankNames[i]}: ${getTeamEmoji(team)} **${team}팀**\n`;
  }

  await interaction.update({
    content: statusText,
    components: [],
  });

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 결과 생성
  const results = allSelectedTeams.map((team, index) => ({
    teamNumber: team,
    rank: index + 1,
  }));

  const finishResult = await container.gameService.finishGame(guildId, gameId, results);

  if (!finishResult.success) {
    let errorMessage = '❌ 결과 처리에 실패했습니다.';
    const errorType = finishResult.error.type;

    if (errorType === 'GAME_NOT_FOUND') {
      errorMessage = '❌ 게임을 찾을 수 없습니다.';
    } else if (errorType === 'GAME_ALREADY_FINISHED') {
      errorMessage = '❌ 이미 종료된 게임입니다.';
    } else if (errorType === 'REPOSITORY_ERROR') {
      const cause = (finishResult.error as { cause?: { message?: string } }).cause;
      errorMessage = `❌ DB 오류: ${cause?.message || '알 수 없는 오류'}`;
      console.error('[GAME] finishGame error:', finishResult.error);
    }

    await interaction.editReply({ content: errorMessage });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const { game: finishedGame, rewards } = finishResult.data;

  // 메시지 업데이트
  try {
    if (finishedGame.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(finishedGame.messageId);

      const participantsResult = await container.gameService.getParticipants(gameId);
      const participants = participantsResult.success ? participantsResult.data : [];

      const gameContainer = createGameContainer(finishedGame, topyName, participants);
      await message.edit({
        components: [gameContainer],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
      });

      // 10분 후 메시지 삭제
      setTimeout(async () => {
        try {
          await message.delete();
        } catch {
          // 이미 삭제됨
        }
      }, LONG_DELETE_DELAY);
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  const totalRewarded = rewards.reduce((sum, r) => sum + r.reward, BigInt(0));

  let resultText = '✅ 결과가 처리되었습니다!\n\n';
  for (let i = 0; i < allSelectedTeams.length; i++) {
    const team = allSelectedTeams[i]!;
    resultText += `${rankEmojis[i]} ${rankNames[i]}: ${getTeamEmoji(team)} ${team}팀\n`;
  }
  resultText += `\n총 보상: ${totalRewarded.toLocaleString()} ${topyName} (${rewards.length}명)`;

  await interaction.editReply({ content: resultText });
  scheduleEphemeralDelete(interaction, LONG_DELETE_DELAY);
}

// ============================================================
// 게임 취소 핸들러
// ============================================================

/**
 * 게임 취소 핸들러
 */
export async function handleGameCancel(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 조회 (권한 확인용)
  const gameCheckResult = await container.gameService.getGameById(gameId);
  if (!gameCheckResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 권한 확인 (관리자 또는 방장)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminOrCreator(interaction, managerRoleId, gameCheckResult.data)) {
    await interaction.reply({
      content: '❌ 관리자 또는 방장만 게임을 취소할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 게임 취소
  const cancelResult = await container.gameService.cancelGame(guildId, gameId);

  if (!cancelResult.success) {
    let errorMessage = '❌ 게임 취소에 실패했습니다.';
    const errorType = cancelResult.error.type;

    if (errorType === 'GAME_NOT_FOUND') {
      errorMessage = '❌ 게임을 찾을 수 없습니다.';
    } else if (errorType === 'GAME_ALREADY_FINISHED') {
      errorMessage = '❌ 이미 종료된 게임입니다.';
    } else if (errorType === 'REPOSITORY_ERROR') {
      const cause = (cancelResult.error as { cause?: { message?: string } }).cause;
      errorMessage = `❌ DB 오류: ${cause?.message || '알 수 없는 오류'}`;
      console.error('[GAME] cancelGame error:', cancelResult.error);
    }

    await interaction.editReply({ content: errorMessage });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const { game, refundedCount } = cancelResult.data;

  // 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const gameContainer = createGameContainer(game, topyName);
      await message.edit({
        components: [gameContainer],
        flags: MessageFlags.IsComponentsV2,
        embeds: [],
      });

      // 10분 후 메시지 삭제
      setTimeout(async () => {
        try {
          await message.delete();
        } catch {
          // 이미 삭제됨
        }
      }, LONG_DELETE_DELAY);
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  await interaction.editReply({
    content: `✅ 게임이 취소되었습니다.\n\n환불: ${refundedCount}명\n총 환불액: ${game.totalPool.toLocaleString()} ${topyName}`,
  });
  scheduleEphemeralDelete(interaction, LONG_DELETE_DELAY);
}

// ============================================================
// 승인 시스템 핸들러
// ============================================================

/**
 * 내전 승인 버튼 핸들러
 */
export async function handleGameApprove(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 내전을 승인할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.editReply({ content: '❌ 게임을 찾을 수 없습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;

  // 이미 승인된 상태인지 확인
  if (game.status !== 'pending_approval') {
    await interaction.editReply({ content: '❌ 이미 처리된 요청입니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 승인
  const approveResult = await container.gameService.approveGame(gameId);
  if (!approveResult.success) {
    await interaction.editReply({ content: '❌ 승인 처리에 실패했습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const approvedGame = approveResult.data;

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 원래 채널에 게임 패널 생성
  try {
    const originalChannel = await interaction.client.channels.fetch(approvedGame.channelId) as TextChannel;
    if (originalChannel) {
      const gameContainer = createGameContainer(approvedGame, topyName, []);
      const buttons = createGameButtons(approvedGame, true);

      const message = await originalChannel.send({
        content: `✅ <@${approvedGame.createdBy}>님의 내전이 승인되었습니다!`,
        components: [gameContainer, ...buttons],
        flags: MessageFlags.IsComponentsV2,
      });

      // 메시지 ID 저장
      await container.gameService.updateGameMessageId(approvedGame.id, message.id);
    }
  } catch (err) {
    console.error('[GAME] Failed to create game panel:', err);
  }

  // 승인 요청 메시지 업데이트
  try {
    const approvalMessage = interaction.message;
    await approvalMessage.edit({
      content: `✅ **승인됨** - <@${interaction.user.id}>님이 승인`,
      components: [],
    });
  } catch {
    // 메시지 업데이트 실패 무시
  }

  await interaction.editReply({
    content: `✅ **${approvedGame.title}** 내전이 승인되었습니다.`,
  });
  scheduleEphemeralDelete(interaction);
}

/**
 * 내전 조정 버튼 핸들러 (모달 표시)
 */
export async function handleGameAdjust(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 내전을 조정할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;

  // 조정 모달 표시
  const modal = new ModalBuilder()
    .setCustomId(`game_adjust_modal_${gameId}`)
    .setTitle('✏️ 내전 조정');

  const entryFeeInput = new TextInputBuilder()
    .setCustomId('entry_fee')
    .setLabel('참가비')
    .setStyle(TextInputStyle.Short)
    .setValue(game.entryFee.toString())
    .setPlaceholder('예: 1000')
    .setRequired(true);

  const rewardsInput = new TextInputBuilder()
    .setCustomId('rewards')
    .setLabel('순위 보상 비율 (쉼표로 구분)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 50,30,20 또는 승자독식')
    .setRequired(false);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('조정 사유')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('조정 사유를 입력하세요')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(entryFeeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(rewardsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

/**
 * 내전 조정 모달 제출 핸들러
 */
export async function handleGameAdjustModal(
  interaction: ModalSubmitInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.editReply({ content: '❌ 게임을 찾을 수 없습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const originalGame = gameResult.data;

  // 입력값 파싱
  const entryFeeRaw = interaction.fields.getTextInputValue('entry_fee');
  const rewardsRaw = interaction.fields.getTextInputValue('rewards');
  const reason = interaction.fields.getTextInputValue('reason');

  const newEntryFee = BigInt(parseInt(entryFeeRaw) || 100);

  // 순위보상 파싱
  let newRankRewards: RankRewards | null = null;
  if (rewardsRaw.trim()) {
    const parsed = parseRewardsInput(rewardsRaw);
    if (parsed.error) {
      await interaction.editReply({ content: `❌ ${parsed.error}` });
      scheduleEphemeralDelete(interaction);
      return;
    }
    newRankRewards = parsed.customRankRewards;
  }

  // 게임 조정 (참가비/보상배율 수정 후 승인)
  const adjustResult = await container.gameService.adjustGame(gameId, newEntryFee, newRankRewards);
  if (!adjustResult.success) {
    await interaction.editReply({ content: '❌ 조정 처리에 실패했습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const adjustedGame = adjustResult.data;

  // 화폐 설정 조회
  const currencySettingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

  // 조정 내용 메시지 생성
  let adjustmentText = `📝 **조정 내용**\n`;
  if (originalGame.entryFee !== newEntryFee) {
    adjustmentText += `- 참가비: ${originalGame.entryFee.toLocaleString()} → ${newEntryFee.toLocaleString()} ${topyName}\n`;
  }
  if (newRankRewards) {
    const rewardText = Object.entries(newRankRewards)
      .map(([rank, ratio]) => `${rank}등: ${ratio}`)
      .join(', ');
    adjustmentText += `- 순위 보상: ${rewardText}\n`;
  }
  adjustmentText += `\n💬 **사유**: ${reason}`;

  // 원래 채널에 게임 패널 생성
  try {
    const originalChannel = await interaction.client.channels.fetch(adjustedGame.channelId) as TextChannel;
    if (originalChannel) {
      const gameContainer = createGameContainer(adjustedGame, topyName, []);
      const buttons = createGameButtons(adjustedGame, true);

      await originalChannel.send({
        content: `✅ <@${adjustedGame.createdBy}>님의 내전이 조정 후 승인되었습니다!\n\n${adjustmentText}`,
        components: [gameContainer, ...buttons],
        flags: MessageFlags.IsComponentsV2,
      });

      // 메시지 ID 저장
      await container.gameService.updateGameMessageId(adjustedGame.id, originalChannel.lastMessageId!);
    }
  } catch (err) {
    console.error('[GAME] Failed to create game panel:', err);
  }

  // 승인 요청 메시지 업데이트
  try {
    // 모달 제출 시에는 interaction.message가 없으므로 별도 처리 불가
    // 대신 채널에서 메시지를 찾아야 함
  } catch {
    // 메시지 업데이트 실패 무시
  }

  await interaction.editReply({
    content: `✅ **${adjustedGame.title}** 내전이 조정 후 승인되었습니다.\n\n${adjustmentText}`,
  });
  scheduleEphemeralDelete(interaction);
}

/**
 * 내전 거절 버튼 핸들러 (모달 표시)
 */
export async function handleGameReject(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 내전을 거절할 수 있습니다.',
      ephemeral: true,
    });
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 거절 사유 모달 표시
  const modal = new ModalBuilder()
    .setCustomId(`game_reject_modal_${gameId}`)
    .setTitle('❌ 내전 거절');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('거절 사유')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('거절 사유를 입력하세요')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

/**
 * 내전 거절 모달 제출 핸들러
 */
export async function handleGameRejectModal(
  interaction: ModalSubmitInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    scheduleEphemeralDelete(interaction);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.editReply({ content: '❌ 게임을 찾을 수 없습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = gameResult.data;
  const reason = interaction.fields.getTextInputValue('reason');

  // 게임 거절 (삭제)
  const rejectResult = await container.gameService.rejectGame(gameId);
  if (!rejectResult.success) {
    if (rejectResult.error.type === 'GAME_NOT_PENDING') {
      await interaction.editReply({ content: '❌ 이미 처리된 요청입니다.' });
    } else {
      await interaction.editReply({ content: '❌ 거절 처리에 실패했습니다.' });
    }
    scheduleEphemeralDelete(interaction);
    return;
  }

  // 요청자에게 DM 또는 원래 채널에 알림
  try {
    const originalChannel = await interaction.client.channels.fetch(game.channelId) as TextChannel;
    if (originalChannel) {
      await originalChannel.send({
        content: `❌ <@${game.createdBy}>님의 내전 생성 요청이 거절되었습니다.\n\n**제목**: ${game.title}\n💬 **사유**: ${reason}`,
      });
    }
  } catch (err) {
    console.error('[GAME] Failed to send rejection message:', err);
  }

  // 승인 요청 메시지 업데이트
  try {
    // 모달 제출 시에는 별도 처리 필요
  } catch {
    // 메시지 업데이트 실패 무시
  }

  await interaction.editReply({
    content: `❌ **${game.title}** 내전 요청이 거절되었습니다.\n\n💬 **사유**: ${reason}`,
  });
  scheduleEphemeralDelete(interaction);
}
