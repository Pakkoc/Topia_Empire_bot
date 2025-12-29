import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import type { GameService, CurrencyService, Game, GameTeam } from '@topia/core';
import { calculateTeamOdds } from '@topia/core';

interface Container {
  gameService: GameService;
  currencyService: CurrencyService;
}

// ============================================================
// 헬퍼 함수들
// ============================================================

/**
 * 배팅 메시지 Embed 생성
 */
function createBetMessageEmbed(
  game: Game,
  topyName: string,
  betCount: { teamA: number; teamB: number } = { teamA: 0, teamB: 0 },
  betLimits?: { minBet: bigint; maxBet: bigint }
): EmbedBuilder {
  const { teamAOdds, teamBOdds } = calculateTeamOdds(game);
  const totalPool = game.teamAPool + game.teamBPool;

  const embed = new EmbedBuilder()
    .setColor(game.status === 'open' ? 0x5865F2 : game.status === 'finished' ? 0x00FF00 : 0x808080)
    .setTitle(`🎮 ${game.title}`)
    .setTimestamp();

  if (game.status === 'open') {
    embed.setDescription('아래 버튼을 눌러 배팅하세요!');
  } else if (game.status === 'closed') {
    embed.setDescription('🔒 배팅이 마감되었습니다.\n경기 진행 중...');
  } else if (game.status === 'finished') {
    const winnerTeam = game.winner === 'A' ? game.teamA : game.teamB;
    embed.setDescription(`🏆 **${winnerTeam}** 승리!\n\n정산이 완료되었습니다.`);
  } else if (game.status === 'cancelled') {
    embed.setDescription('❌ 경기가 취소되었습니다.\n배팅금이 환불되었습니다.');
  }

  // 팀 정보
  embed.addFields(
    {
      name: `🔵 ${game.teamA}`,
      value: `${game.teamAPool.toLocaleString()} ${topyName}\n배당률: ${teamAOdds.toFixed(2)}배\n참여: ${betCount.teamA}명`,
      inline: true,
    },
    {
      name: `🔴 ${game.teamB}`,
      value: `${game.teamBPool.toLocaleString()} ${topyName}\n배당률: ${teamBOdds.toFixed(2)}배\n참여: ${betCount.teamB}명`,
      inline: true,
    }
  );

  embed.addFields({
    name: '💰 총 배팅 풀',
    value: `${totalPool.toLocaleString()} ${topyName}`,
    inline: false,
  });

  if (game.status === 'open' && betLimits) {
    embed.setFooter({
      text: `⚠️ 배팅은 1인 1회만 가능합니다\n💰 배팅 한도: ${betLimits.minBet.toLocaleString()} ~ ${betLimits.maxBet.toLocaleString()} ${topyName}`
    });
  }

  return embed;
}

/**
 * 배팅 메시지 버튼 생성
 */
function createBetMessageButtons(game: Game, isAdmin: boolean): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (game.status === 'open') {
    // 배팅 버튼
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`game_bet_A_${game.id}`)
          .setLabel(game.teamA)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔵'),
        new ButtonBuilder()
          .setCustomId(`game_bet_B_${game.id}`)
          .setLabel(game.teamB)
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔴')
      )
    );

    // 관리자 버튼 (open 상태: 배팅 마감, 경기 취소)
    if (isAdmin) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`game_close_${game.id}`)
            .setLabel('배팅 마감')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId(`game_cancel_${game.id}`)
            .setLabel('경기 취소')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        )
      );
    }
  } else if (game.status === 'closed') {
    // 관리자 버튼 (closed 상태: 결과 입력, 경기 취소)
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
            .setLabel('경기 취소')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        )
      );
    }
  }

  return rows;
}

/**
 * 관리자 권한 확인 (역할 또는 서버관리 권한)
 */
function isAdminUser(interaction: ButtonInteraction, managerRoleId: string | null): boolean {
  // 서버 관리 권한이 있으면 허용
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  // 지정된 관리 역할이 있고, 유저가 해당 역할을 가지고 있으면 허용
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
 * 게임센터 패널 - 배팅 생성 버튼
 */
export async function handleGamePanelCreate(
  interaction: ButtonInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  // 설정 조회 (관리 역할 확인용)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  // 관리자 권한 확인
  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 배팅을 생성할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const uniqueId = `${userId}_${Date.now()}`;

  const modal = new ModalBuilder()
    .setCustomId(`game_create_modal_${uniqueId}`)
    .setTitle('🎮 새 배팅 생성');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('제목')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 발로란트 내전 1조')
    .setMaxLength(200)
    .setRequired(true);

  const teamAInput = new TextInputBuilder()
    .setCustomId('team_a')
    .setLabel('A팀 이름')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 파랑팀')
    .setMaxLength(50)
    .setRequired(true);

  const teamBInput = new TextInputBuilder()
    .setCustomId('team_b')
    .setLabel('B팀 이름')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 빨강팀')
    .setMaxLength(50)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(teamAInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(teamBInput)
  );

  await interaction.showModal(modal);
}

/**
 * 배팅 생성 모달 제출 핸들러
 */
export async function handleGameCreateModal(
  interaction: ModalSubmitInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  if (!guildId || !channelId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const title = interaction.fields.getTextInputValue('title');
  const teamA = interaction.fields.getTextInputValue('team_a');
  const teamB = interaction.fields.getTextInputValue('team_b');

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';

  // 게임센터 설정 조회 (배팅 한도)
  const gameSettingsResult = await container.gameService.getSettings(guildId);
  const betLimits = gameSettingsResult.success
    ? { minBet: gameSettingsResult.data.minBet, maxBet: gameSettingsResult.data.maxBet }
    : { minBet: BigInt(100), maxBet: BigInt(1000000) };

  // 게임 생성
  const createResult = await container.gameService.createGame({
    guildId,
    channelId,
    title,
    teamA,
    teamB,
    createdBy: userId,
  });

  if (!createResult.success) {
    await interaction.editReply({ content: '❌ 배팅 생성에 실패했습니다.' });
    return;
  }

  const game = createResult.data;

  // 채널에 배팅 메시지 전송
  const channel = interaction.channel as TextChannel;
  const embed = createBetMessageEmbed(game, topyName, { teamA: 0, teamB: 0 }, betLimits);
  const buttons = createBetMessageButtons(game, true);

  const message = await channel.send({
    embeds: [embed],
    components: buttons,
  });

  // 메시지 ID 저장
  await container.gameService.updateGameMessageId(game.id, message.id);

  await interaction.editReply({
    content: `✅ 배팅이 생성되었습니다!\n\n**${title}**\n${teamA} vs ${teamB}`,
  });
}

// ============================================================
// 배팅 메시지 핸들러
// ============================================================

/**
 * 팀 배팅 버튼 핸들러
 */
export async function handleGameBet(
  interaction: ButtonInteraction,
  container: Container,
  team: GameTeam,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    return;
  }

  const game = gameResult.data;

  // 게임 상태 확인
  if (game.status !== 'open') {
    await interaction.reply({ content: '❌ 배팅이 마감되었습니다.', ephemeral: true });
    return;
  }

  // 이미 배팅했는지 확인
  const existingBetResult = await container.gameService.getUserBet(gameId, userId);
  if (existingBetResult.success && existingBetResult.data) {
    const existingBet = existingBetResult.data;
    const betTeamName = existingBet.team === 'A' ? game.teamA : game.teamB;
    await interaction.reply({
      content: `❌ 이미 **${betTeamName}**에 ${existingBet.amount.toLocaleString()} 토피를 배팅하셨습니다.\n배팅은 1인 1회만 가능합니다.`,
      ephemeral: true,
    });
    return;
  }

  // 배팅 금액 입력 모달
  const teamName = team === 'A' ? game.teamA : game.teamB;
  const uniqueId = `${userId}_${Date.now()}`;

  const modal = new ModalBuilder()
    .setCustomId(`game_bet_modal_${team}_${gameId}_${uniqueId}`)
    .setTitle(`🎮 ${teamName}에 배팅`);

  const amountInput = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('배팅 금액 (숫자만)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 1000')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
  );

  await interaction.showModal(modal);
}

/**
 * 배팅 금액 모달 제출 핸들러
 */
export async function handleGameBetModal(
  interaction: ModalSubmitInteraction,
  container: Container,
  team: GameTeam,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const amountStr = interaction.fields.getTextInputValue('amount');
  const amount = BigInt(amountStr.replace(/[^0-9]/g, '') || '0');

  if (amount <= BigInt(0)) {
    await interaction.editReply({ content: '❌ 유효한 금액을 입력해주세요.' });
    return;
  }

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';

  // 게임센터 설정 조회 (배팅 한도)
  const gameSettingsResult = await container.gameService.getSettings(guildId);
  const betLimits = gameSettingsResult.success
    ? { minBet: gameSettingsResult.data.minBet, maxBet: gameSettingsResult.data.maxBet }
    : { minBet: BigInt(100), maxBet: BigInt(1000000) };

  // 배팅 실행
  const betResult = await container.gameService.placeBet(guildId, gameId, userId, team, amount);

  if (!betResult.success) {
    let errorMessage = '배팅에 실패했습니다.';

    switch (betResult.error.type) {
      case 'GAME_NOT_FOUND':
        errorMessage = '게임을 찾을 수 없습니다.';
        break;
      case 'GAME_NOT_OPEN':
        errorMessage = '배팅이 마감되었습니다.';
        break;
      case 'ALREADY_BET':
        errorMessage = '이미 배팅하셨습니다. 배팅은 1인 1회만 가능합니다.';
        break;
      case 'BET_AMOUNT_TOO_LOW':
        errorMessage = `최소 ${betResult.error.minBet.toLocaleString()} ${topyName} 이상 배팅해야 합니다.`;
        break;
      case 'BET_AMOUNT_TOO_HIGH':
        errorMessage = `최대 ${betResult.error.maxBet.toLocaleString()} ${topyName}까지 배팅할 수 있습니다.`;
        break;
      case 'INSUFFICIENT_BALANCE':
        errorMessage = `잔액이 부족합니다.\n필요: ${betResult.error.required.toLocaleString()} ${topyName}\n보유: ${betResult.error.available.toLocaleString()} ${topyName}`;
        break;
    }

    await interaction.editReply({ content: `❌ ${errorMessage}` });
    return;
  }

  // 게임 정보 다시 조회 (업데이트된 풀)
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.editReply({ content: '✅ 배팅 완료! (게임 정보 업데이트 실패)' });
    return;
  }

  const game = gameResult.data;
  const teamName = team === 'A' ? game.teamA : game.teamB;

  // 배팅 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      // 배팅 수 조회
      const betsResult = await container.gameService.getGameBets(gameId);
      const bets = betsResult.success ? betsResult.data : [];
      const betCount = {
        teamA: bets.filter(b => b.team === 'A').length,
        teamB: bets.filter(b => b.team === 'B').length,
      };

      const embed = createBetMessageEmbed(game, topyName, betCount, betLimits);
      const buttons = createBetMessageButtons(game, true);
      await message.edit({ embeds: [embed], components: buttons });
    }
  } catch (err) {
    console.error('[GAME] Failed to update bet message:', err);
  }

  const { teamAOdds, teamBOdds } = calculateTeamOdds(game);
  const currentOdds = team === 'A' ? teamAOdds : teamBOdds;

  await interaction.editReply({
    content: `✅ **${teamName}**에 **${amount.toLocaleString()} ${topyName}** 배팅 완료!\n\n현재 배당률: ${currentOdds.toFixed(2)}배`,
  });
}

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
    return;
  }

  // 설정 조회 (관리 역할 확인용)
  const settingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = settingsResult.success ? settingsResult.data.managerRoleId : null;

  // 관리자 권한 확인
  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 결과를 입력할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  // 게임 조회
  const gameResult = await container.gameService.getGameById(gameId);
  if (!gameResult.success) {
    await interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
    return;
  }

  const game = gameResult.data;

  if (game.status !== 'open') {
    await interaction.reply({ content: '❌ 이미 종료된 게임입니다.', ephemeral: true });
    return;
  }

  const userId = interaction.user.id;

  // 승자 선택 메뉴
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`game_result_select_${gameId}_${userId}`)
    .setPlaceholder('승자 팀을 선택하세요')
    .addOptions([
      {
        label: `${game.teamA} 승리`,
        value: 'A',
        emoji: '🔵',
      },
      {
        label: `${game.teamB} 승리`,
        value: 'B',
        emoji: '🔴',
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: '🏆 승자 팀을 선택하세요:',
    components: [row],
    ephemeral: true,
  });
}

/**
 * 결과 선택 핸들러
 */
export async function handleGameResultSelect(
  interaction: ButtonInteraction | any, // StringSelectMenuInteraction
  container: Container,
  gameId: bigint,
  winner: GameTeam
) {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';

  // 게임 종료 및 정산
  const finishResult = await container.gameService.finishGame(guildId, gameId, winner);

  if (!finishResult.success) {
    await interaction.editReply({ content: '❌ 정산에 실패했습니다.', components: [] });
    return;
  }

  const { game, winningBets, losingBets } = finishResult.data;
  const winnerTeam = winner === 'A' ? game.teamA : game.teamB;

  // 배팅 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const betCount = {
        teamA: winningBets.filter(b => b.team === 'A').length + losingBets.filter(b => b.team === 'A').length,
        teamB: winningBets.filter(b => b.team === 'B').length + losingBets.filter(b => b.team === 'B').length,
      };

      const embed = createBetMessageEmbed(game, topyName, betCount);
      await message.edit({ embeds: [embed], components: [] });

      // 10분 후 메시지 삭제
      setTimeout(async () => {
        try {
          await message.delete();
          console.log(`[GAME] Deleted game message ${game.messageId} after 10 minutes`);
        } catch (err) {
          console.error('[GAME] Failed to delete game message:', err);
        }
      }, 10 * 60 * 1000);
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  // 정산 결과 요약
  const totalPayout = winningBets.reduce((sum, b) => sum + (b.payout - b.fee), BigInt(0));

  await interaction.editReply({
    content: `✅ **${winnerTeam}** 승리로 정산 완료!\n\n승리: ${winningBets.length}명\n패배: ${losingBets.length}명\n총 지급: ${totalPayout.toLocaleString()} ${topyName}`,
    components: [],
  });
}

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
    return;
  }

  // 설정 조회 (관리 역할 확인용)
  const gameSettingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = gameSettingsResult.success ? gameSettingsResult.data.managerRoleId : null;

  // 관리자 권한 확인
  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 게임을 취소할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';

  // 게임 취소
  const cancelResult = await container.gameService.cancelGame(guildId, gameId);

  if (!cancelResult.success) {
    await interaction.editReply({ content: '❌ 게임 취소에 실패했습니다.' });
    return;
  }

  const { game, refundedBets } = cancelResult.data;

  // 배팅 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const embed = createBetMessageEmbed(game, topyName);
      await message.edit({ embeds: [embed], components: [] });

      // 10분 후 메시지 삭제
      setTimeout(async () => {
        try {
          await message.delete();
        } catch {
          // 이미 삭제됨
        }
      }, 10 * 60 * 1000);
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  const totalRefund = refundedBets.reduce((sum, b) => sum + b.amount, BigInt(0));

  await interaction.editReply({
    content: `✅ 경기가 취소되었습니다.\n\n환불: ${refundedBets.length}명\n총 환불액: ${totalRefund.toLocaleString()} ${topyName}`,
  });
}

/**
 * 배팅 마감 핸들러
 */
export async function handleGameClose(
  interaction: ButtonInteraction,
  container: Container,
  gameId: bigint
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  // 설정 조회 (관리 역할 확인용)
  const gameSettingsResult = await container.gameService.getSettings(guildId);
  const managerRoleId = gameSettingsResult.success ? gameSettingsResult.data.managerRoleId : null;

  // 관리자 권한 확인
  if (!isAdminUser(interaction, managerRoleId)) {
    await interaction.reply({
      content: '❌ 관리자만 배팅을 마감할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';

  // 배팅 마감
  const closeResult = await container.gameService.closeGame(gameId);

  if (!closeResult.success) {
    let errorMessage = '배팅 마감에 실패했습니다.';
    if (closeResult.error.type === 'GAME_NOT_FOUND') {
      errorMessage = '게임을 찾을 수 없습니다.';
    } else if (closeResult.error.type === 'GAME_NOT_OPEN') {
      errorMessage = '이미 마감되었거나 종료된 게임입니다.';
    }
    await interaction.editReply({ content: `❌ ${errorMessage}` });
    return;
  }

  const game = closeResult.data;

  // 배팅 수 조회
  const betsResult = await container.gameService.getGameBets(gameId);
  const bets = betsResult.success ? betsResult.data : [];
  const betCount = {
    teamA: bets.filter(b => b.team === 'A').length,
    teamB: bets.filter(b => b.team === 'B').length,
  };

  // 배팅 메시지 업데이트
  try {
    if (game.messageId) {
      const channel = interaction.channel as TextChannel;
      const message = await channel.messages.fetch(game.messageId);

      const embed = createBetMessageEmbed(game, topyName, betCount);
      const buttons = createBetMessageButtons(game, true);
      await message.edit({ embeds: [embed], components: buttons });
    }
  } catch (err) {
    console.error('[GAME] Failed to update game message:', err);
  }

  const totalBets = betCount.teamA + betCount.teamB;
  const totalPool = game.teamAPool + game.teamBPool;

  await interaction.editReply({
    content: `🔒 배팅이 마감되었습니다!\n\n참여자: ${totalBets}명\n총 배팅: ${totalPool.toLocaleString()} ${topyName}`,
  });
}
