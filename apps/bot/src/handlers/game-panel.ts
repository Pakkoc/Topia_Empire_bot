import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type TextChannel,
  type UserSelectMenuInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { GameService, CurrencyService, Game, GameParticipant, GameCategory, RankRewards } from '@topia/core';

interface Container {
  gameService: GameService;
  currencyService: CurrencyService;
}

// 10분 후 ephemeral 메시지 삭제
const EPHEMERAL_DELETE_DELAY = 10 * 60 * 1000;

function scheduleEphemeralDelete(interaction: ButtonInteraction | ModalSubmitInteraction | UserSelectMenuInteraction | StringSelectMenuInteraction | any) {
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch {
      // 이미 삭제됨
    }
  }, EPHEMERAL_DELETE_DELAY);
}

// ============================================================
// 헬퍼 함수들
// ============================================================

/**
 * 내전 메시지 Embed 생성
 */
function createGameEmbed(
  game: Game,
  topyName: string,
  participants: GameParticipant[] = [],
  rankRewards?: Record<number, number>
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(
      game.status === 'open' ? 0x00FF00 :
      game.status === 'team_assign' ? 0xFFFF00 :
      game.status === 'in_progress' ? 0x5865F2 :
      game.status === 'finished' ? 0x808080 : 0xFF0000
    )
    .setTitle(`🎮 ${game.title}`)
    .setTimestamp();

  // 상태별 설명
  const statusText = {
    'open': '🟢 모집중',
    'team_assign': '🟡 팀 배정중',
    'in_progress': '🔵 경기중',
    'finished': '✅ 완료',
    'cancelled': '❌ 취소됨',
  };

  embed.setDescription(`**상태: ${statusText[game.status]}**`);

  // 참가 정보
  const participantText = game.maxPlayersPerTeam !== null
    ? `${participants.length}/${game.maxPlayersPerTeam * game.teamCount}명`
    : `${participants.length}명`;

  embed.addFields(
    {
      name: '💰 참가비',
      value: `${game.entryFee.toLocaleString()} ${topyName}`,
      inline: true,
    },
    {
      name: '👥 참가자',
      value: participantText,
      inline: true,
    },
    {
      name: '🏆 상금 풀',
      value: `${game.totalPool.toLocaleString()} ${topyName}`,
      inline: true,
    }
  );

  // 보상 비율 표시 (동적 순위 지원)
  if (game.status === 'open') {
    // 커스텀 설정 우선 표시
    if (game.customWinnerTakesAll) {
      embed.addFields({
        name: '🎁 순위별 보상',
        value: '🏆 **승자 독식** (1등 100%)',
        inline: false,
      });
    } else if (game.customRankRewards) {
      // 비율 정규화하여 표시
      const total = Object.values(game.customRankRewards).reduce((a, b) => a + b, 0);
      const rewardEntries = Object.entries(game.customRankRewards)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([rank, ratio]) => {
          const percent = total > 0 ? Math.round((ratio / total) * 100) : 0;
          return `${rank}등: ${percent}%`;
        })
        .join(' | ');

      embed.addFields({
        name: '🎁 순위별 보상 (커스텀)',
        value: rewardEntries,
        inline: false,
      });
    } else if (rankRewards) {
      // 비율 정규화하여 표시
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
        embed.addFields({
          name: '🎁 순위별 보상',
          value: rewardEntries,
          inline: false,
        });
      }
    }
  }

  // 참가자 목록
  if (participants.length > 0) {
    if (game.status === 'open' || game.status === 'team_assign') {
      // 미배정 참가자 목록
      const participantMentions = participants.map(p => `<@${p.userId}>`).join(', ');
      embed.addFields({
        name: '📋 참가자 목록',
        value: participantMentions.length > 1000 ? participantMentions.substring(0, 997) + '...' : participantMentions,
        inline: false,
      });
    } else if (game.status === 'in_progress' || game.status === 'finished') {
      // 팀별 참가자 표시
      for (let teamNum = 1; teamNum <= game.teamCount; teamNum++) {
        const teamMembers = participants.filter(p => p.teamNumber === teamNum);
        if (teamMembers.length > 0) {
          const teamColor = getTeamEmoji(teamNum);
          const memberMentions = teamMembers.map(p => `<@${p.userId}>`).join(', ');
          embed.addFields({
            name: `${teamColor} ${teamNum}팀`,
            value: memberMentions,
            inline: true,
          });
        }
      }
    }
  }

  return embed;
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
    // 참가 버튼
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

    // 관리자 버튼
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
    // 관리자: 팀 배정 계속
    if (isAdmin) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`game_team_assign_${game.id}`)
            .setLabel('팀 배정')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎲'),
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
    // 관리자: 결과 입력
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

  // 관리자 권한 확인
  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 내전을 생성할 수 있습니다.',
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

  // 관리자 권한 확인
  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 내전을 생성할 수 있습니다.',
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
    // 카테고리에서 팀 수 가져오기
    const categoriesResult = await container.gameService.getCategories(guildId);
    if (categoriesResult.success) {
      const category = categoriesResult.data.find(c => c.id === categoryId);
      if (category) {
        teamCount = category.teamCount;
        selectedCategoryId = category.id;
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

  // 채널에 내전 메시지 전송
  const channel = interaction.channel as TextChannel;
  const embed = createGameEmbed(game, topyName, [], displayRankRewards);
  const buttons = createGameButtons(game, true);

  const message = await channel.send({
    embeds: [embed],
    components: buttons,
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

      const embed = createGameEmbed(game, topyName, participants, rankRewards);
      const buttons = createGameButtons(game, true);
      await message.edit({ embeds: [embed], components: buttons });
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

      const embed = createGameEmbed(game, topyName, participants, rankRewards);
      const buttons = createGameButtons(game, true);
      await message.edit({ embeds: [embed], components: buttons });
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

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 팀을 배정할 수 있습니다.',
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
  const userId = interaction.user.id;

  // 팀 선택 메뉴
  const selectOptions = [];
  for (let i = 1; i <= game.teamCount; i++) {
    selectOptions.push({
      label: `${i}팀`,
      value: i.toString(),
      emoji: getTeamEmoji(i),
    });
  }

  const teamSelect = new StringSelectMenuBuilder()
    .setCustomId(`game_team_select_${gameId}_${userId}`)
    .setPlaceholder('팀을 선택하세요')
    .addOptions(selectOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamSelect);

  await interaction.reply({
    content: '🎲 배정할 팀을 선택하세요:',
    components: [row],
    ephemeral: true,
  });
  scheduleEphemeralDelete(interaction);
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

  // 참가자 목록 조회 (아직 팀 배정 안 된 사람만)
  const participantsResult = await container.gameService.getParticipants(gameId);
  if (!participantsResult.success) {
    await interaction.update({ content: '❌ 참가자 목록을 불러올 수 없습니다.', components: [] });
    return;
  }

  const unassignedParticipants = participantsResult.data.filter(p => p.teamNumber === null);

  if (unassignedParticipants.length === 0) {
    await interaction.update({ content: '✅ 모든 참가자가 이미 팀에 배정되었습니다.', components: [] });
    return;
  }

  // 참가자 선택 메뉴 (StringSelectMenuBuilder로 참가자만 표시)
  const participantOptions = unassignedParticipants.slice(0, 25).map(p => ({
    label: `참가자`,
    value: p.userId,
    description: `<@${p.userId}>`,
  }));

  // Discord에서 유저 이름을 가져오기 위해 멤버 조회
  try {
    const guild = interaction.guild;
    if (guild) {
      for (const option of participantOptions) {
        try {
          const member = await guild.members.fetch(option.value);
          option.label = member.displayName || member.user.username;
          option.description = `@${member.user.username}`;
        } catch {
          option.label = `유저 (${option.value.slice(-4)})`;
        }
      }
    }
  } catch {
    // 멤버 조회 실패해도 계속 진행
  }

  const userSelect = new StringSelectMenuBuilder()
    .setCustomId(`game_team_users_${gameId}_${teamNumber}_${odminUserId}`)
    .setPlaceholder('팀원을 선택하세요 (참가자만 표시)')
    .setMinValues(1)
    .setMaxValues(Math.min(unassignedParticipants.length, 25))
    .addOptions(participantOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(userSelect);

  await interaction.update({
    content: `${getTeamEmoji(teamNumber)} **${teamNumber}팀** 팀원을 선택하세요:\n(미배정 참가자 ${unassignedParticipants.length}명)`,
    components: [row],
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
    await interaction.update({ content: '서버에서만 사용할 수 있습니다.', components: [] });
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

    await interaction.update({ content: `❌ ${errorMessage}`, components: [] });
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

        const embed = createGameEmbed(game, topyName, participants);
        const buttons = createGameButtons(game, true);
        await message.edit({ embeds: [embed], components: buttons });
      }
    } catch (err) {
      console.error('[GAME] Failed to update game message:', err);
    }
  }

  await interaction.update({
    content: `✅ ${getTeamEmoji(teamNumber)} **${teamNumber}팀**에 ${selectedUserIds.length}명을 배정했습니다.`,
    components: [],
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

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 경기를 시작할 수 있습니다.',
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

      const embed = createGameEmbed(game, topyName, participants);
      const buttons = createGameButtons(game, true);
      await message.edit({ embeds: [embed], components: buttons });
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  await interaction.editReply({ content: '✅ 경기가 시작되었습니다!' });
  scheduleEphemeralDelete(interaction);
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

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 결과를 입력할 수 있습니다.',
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
  const userId = interaction.user.id;

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
    await interaction.editReply({ content: '❌ 결과 처리에 실패했습니다.' });
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

      const embed = createGameEmbed(finishedGame, topyName, participants);
      await message.edit({ embeds: [embed], components: [] });

      // 10분 후 메시지 삭제
      setTimeout(async () => {
        try {
          await message.delete();
        } catch {
          // 이미 삭제됨
        }
      }, EPHEMERAL_DELETE_DELAY);
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
  scheduleEphemeralDelete(interaction);
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

  // 권한 확인
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 게임을 취소할 수 있습니다.',
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
    await interaction.editReply({ content: '❌ 게임 취소에 실패했습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const { game, refundedCount } = cancelResult.data;

  // 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const embed = createGameEmbed(game, topyName);
      await message.edit({ embeds: [embed], components: [] });

      // 10분 후 메시지 삭제
      setTimeout(async () => {
        try {
          await message.delete();
        } catch {
          // 이미 삭제됨
        }
      }, EPHEMERAL_DELETE_DELAY);
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  await interaction.editReply({
    content: `✅ 게임이 취소되었습니다.\n\n환불: ${refundedCount}명\n총 환불액: ${game.totalPool.toLocaleString()} ${topyName}`,
  });
  scheduleEphemeralDelete(interaction);
}
