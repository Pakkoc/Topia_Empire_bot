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
import type { GameService, CurrencyService, Game, GameParticipant, GameCategory } from '@topia/core';

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
  rankPercents?: { rank1: number; rank2: number; rank3: number; rank4: number }
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
  embed.addFields(
    {
      name: '💰 참가비',
      value: `${game.entryFee.toLocaleString()} ${topyName}`,
      inline: true,
    },
    {
      name: '👥 참가자',
      value: `${participants.length}명`,
      inline: true,
    },
    {
      name: '🏆 상금 풀',
      value: `${game.totalPool.toLocaleString()} ${topyName}`,
      inline: true,
    }
  );

  // 보상 비율 표시
  if (rankPercents && game.status === 'open') {
    embed.addFields({
      name: '🎁 순위별 보상',
      value: `1등: ${rankPercents.rank1}% | 2등: ${rankPercents.rank2}% | 3등: ${rankPercents.rank3}% | 4등: ${rankPercents.rank4}%`,
      inline: false,
    });
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
 * 내전 패널 - 내전 생성 버튼
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
    // 카테고리가 없으면 모달로 직접 입력
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
      .setPlaceholder('예: 2')
      .setValue('2')
      .setMaxLength(2)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(teamCountInput)
    );

    await interaction.showModal(modal);
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
    // 직접 입력한 팀 수
    const teamCountStr = interaction.fields.getTextInputValue('team_count');
    teamCount = parseInt(teamCountStr) || 2;
    if (teamCount < 2) teamCount = 2;
    if (teamCount > 8) teamCount = 8;
  }

  // 설정 조회
  const settingsResult = await container.gameService.getSettings(guildId);
  const entryFee = settingsResult.success ? settingsResult.data.entryFee : BigInt(100);
  const rankPercents = settingsResult.success ? {
    rank1: settingsResult.data.rank1Percent,
    rank2: settingsResult.data.rank2Percent,
    rank3: settingsResult.data.rank3Percent,
    rank4: settingsResult.data.rank4Percent,
  } : { rank1: 50, rank2: 30, rank3: 15, rank4: 5 };

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
    entryFee,
    createdBy: userId,
  });

  if (!createResult.success) {
    await interaction.editReply({ content: '❌ 내전 생성에 실패했습니다.' });
    scheduleEphemeralDelete(interaction);
    return;
  }

  const game = createResult.data;

  // 채널에 내전 메시지 전송
  const channel = interaction.channel as TextChannel;
  const embed = createGameEmbed(game, topyName, [], rankPercents);
  const buttons = createGameButtons(game, true);

  const message = await channel.send({
    embeds: [embed],
    components: buttons,
  });

  // 메시지 ID 저장
  await container.gameService.updateGameMessageId(game.id, message.id);

  await interaction.editReply({
    content: `✅ 내전이 생성되었습니다!\n\n**${title}**\n팀 수: ${teamCount}팀\n참가비: ${entryFee.toLocaleString()} ${topyName}`,
  });
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
      const rankPercents = settingsResult.success ? {
        rank1: settingsResult.data.rank1Percent,
        rank2: settingsResult.data.rank2Percent,
        rank3: settingsResult.data.rank3Percent,
        rank4: settingsResult.data.rank4Percent,
      } : undefined;

      const embed = createGameEmbed(game, topyName, participants, rankPercents);
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
      const rankPercents = settingsResult.success ? {
        rank1: settingsResult.data.rank1Percent,
        rank2: settingsResult.data.rank2Percent,
        rank3: settingsResult.data.rank3Percent,
        rank4: settingsResult.data.rank4Percent,
      } : undefined;

      const embed = createGameEmbed(game, topyName, participants, rankPercents);
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

  const userId = interaction.user.id;

  // 유저 선택 메뉴
  const userSelect = new UserSelectMenuBuilder()
    .setCustomId(`game_team_users_${gameId}_${teamNumber}_${userId}`)
    .setPlaceholder('팀원을 선택하세요')
    .setMinValues(1)
    .setMaxValues(25);

  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);

  await interaction.update({
    content: `${getTeamEmoji(teamNumber)} **${teamNumber}팀** 팀원을 선택하세요:`,
    components: [row],
  });
}

/**
 * 유저 선택 완료 핸들러
 */
export async function handleGameTeamUsers(
  interaction: UserSelectMenuInteraction,
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
 * 순위 선택 핸들러 (1등 또는 2등)
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

  // customId: game_result_rank_{gameId}_{currentRank}_{userId} 또는
  // customId: game_result_rank_{gameId}_{currentRank}_{rank1Team}_{userId}
  const parts = interaction.customId.split('_');
  const gameId = BigInt(parts[3]!);
  const currentRank = parseInt(parts[4]!, 10);
  const selectedTeam = parseInt(interaction.values[0]!, 10);
  const userId = interaction.user.id;

  // 1등 선택인 경우 → 2등 선택 UI 표시
  if (currentRank === 1) {
    // 게임 정보 조회
    const gameResult = await container.gameService.getGameById(gameId);
    if (!gameResult.success) {
      await interaction.update({ content: '❌ 게임을 찾을 수 없습니다.', components: [] });
      return;
    }

    const game = gameResult.data;

    // 2등 선택 메뉴 (1등으로 선택된 팀 제외)
    const teamOptions = [];
    for (let i = 1; i <= game.teamCount; i++) {
      if (i === selectedTeam) continue; // 1등으로 선택된 팀 제외
      teamOptions.push({
        label: `${i}팀`,
        value: i.toString(),
        emoji: getTeamEmoji(i),
      });
    }

    const rank2Select = new StringSelectMenuBuilder()
      .setCustomId(`game_result_rank_${gameId}_2_${selectedTeam}_${userId}`)
      .setPlaceholder('🥈 2등 팀을 선택하세요')
      .addOptions(teamOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rank2Select);

    await interaction.update({
      content: `🏆 **순위를 선택하세요**\n\n🥇 1등: ${getTeamEmoji(selectedTeam)} **${selectedTeam}팀**\n\n이제 2등 팀을 선택하세요.`,
      components: [row],
    });
    return;
  }

  // 2등 선택인 경우 → 바로 결과 처리
  if (currentRank === 2) {
    const rank1Team = parseInt(parts[5]!, 10); // 1등 팀 번호
    const rank2Team = selectedTeam;

    await interaction.update({
      content: `⏳ 결과 처리 중...\n\n🥇 1등: ${getTeamEmoji(rank1Team)} **${rank1Team}팀**\n🥈 2등: ${getTeamEmoji(rank2Team)} **${rank2Team}팀**`,
      components: [],
    });

    // 화폐 설정 조회
    const currencySettingsResult = await container.currencyService.getSettings(guildId);
    const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

    // 결과 처리
    const results = [
      { teamNumber: rank1Team, rank: 1 },
      { teamNumber: rank2Team, rank: 2 },
    ];

    const finishResult = await container.gameService.finishGame(guildId, gameId, results);

    if (!finishResult.success) {
      await interaction.editReply({ content: '❌ 결과 처리에 실패했습니다.' });
      scheduleEphemeralDelete(interaction);
      return;
    }

    const { game, rewards } = finishResult.data;

    // 메시지 업데이트
    try {
      if (game.messageId) {
        const channel = interaction.channel as TextChannel;
        const message = await channel.messages.fetch(game.messageId);

        const participantsResult = await container.gameService.getParticipants(gameId);
        const participants = participantsResult.success ? participantsResult.data : [];

        const embed = createGameEmbed(game, topyName, participants);
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

    await interaction.editReply({
      content: `✅ 결과가 처리되었습니다!\n\n🥇 1등: ${getTeamEmoji(rank1Team)} ${rank1Team}팀\n🥈 2등: ${getTeamEmoji(rank2Team)} ${rank2Team}팀\n\n총 보상: ${totalRewarded.toLocaleString()} ${topyName} (${rewards.length}명)`,
    });
    scheduleEphemeralDelete(interaction);
  }
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
