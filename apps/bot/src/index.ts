import 'dotenv/config';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Events,
  VoiceState,
  REST,
  Routes,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { createPool, createRedisClient, createContainer, getPool, type Container } from '@topia/infra';
import { createXpHandler } from './handlers/xp.handler';
import { createCurrencyHandler } from './handlers/currency.handler';
import {
  handleMarketPanelList,
  handleMarketPanelRegister,
  handleMarketPanelRegisterModal,
  handleMarketPanelMy,
} from './handlers/market-panel';
import { handleShopPanelButton } from './handlers/shop-panel';
import { handleTopyShopPanelButton } from './handlers/shop-topy-panel';
import { handleRubyShopPanelButton } from './handlers/shop-ruby-panel';
import {
  handleGamePanelCreate,
  handleGameCategorySelect,
  handleGameCreateModal,
  handleGameJoin,
  handleGameLeave,
  handleGameTeamAssign,
  handleGameTeamSelect,
  handleGameTeamUsers,
  handleGameStart,
  handleGameResult,
  handleGameResultRank,
  handleGameCancel,
} from './handlers/game-panel';
import { commands, type Command } from './commands';
import { startExpiredItemsScheduler } from './schedulers/expired-items.scheduler';
import { startMonthlyTaxScheduler } from './schedulers/monthly-tax.scheduler';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// Track users in voice channels for XP
const voiceUsers = new Map<string, { guildId: string; channelId: string; roleIds: string[]; joinedAt: Date }>();

// Command collection
const commandCollection = new Collection<string, Command>();

// Register slash commands to Discord
async function registerCommands(token: string, clientId: string) {
  const rest = new REST().setToken(token);
  const commandData = commands.map(cmd => cmd.data.toJSON());

  try {
    console.log(`[COMMANDS] Registering ${commands.length} slash commands...`);

    await rest.put(Routes.applicationCommands(clientId), { body: commandData });

    console.log(`[COMMANDS] Successfully registered ${commands.length} commands`);
  } catch (error) {
    console.error('[COMMANDS] Failed to register commands:', error);
  }
}

async function main() {
  // Database 초기화
  createPool({
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '3306'),
    user: process.env['DB_USER'] || 'root',
    password: process.env['DB_PASSWORD'] || '',
    database: process.env['DB_NAME'] || 'topia_empire',
  });

  // Redis 초기화
  createRedisClient({
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379'),
    password: process.env['REDIS_PASSWORD'],
  });

  // DI Container 생성
  const container = createContainer();

  // Handlers 생성
  const xpHandler = createXpHandler(container, client);
  const currencyHandler = createCurrencyHandler(container, client);

  // Load commands into collection
  for (const command of commands) {
    commandCollection.set(command.data.name, command);
  }

  // Token 가져오기 (명령어 등록에 필요)
  const token = process.env['DISCORD_TOKEN'];
  if (!token) {
    throw new Error('DISCORD_TOKEN is required');
  }

  // Register slash commands
  const clientId = process.env['DISCORD_CLIENT_ID'];
  if (clientId) {
    await registerCommands(token, clientId);
  } else {
    console.warn('[COMMANDS] DISCORD_CLIENT_ID not set, skipping command registration');
  }

  // Events
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Bot ready! Logged in as ${c.user.tag}`);

    // 만료 아이템 스케줄러 시작
    startExpiredItemsScheduler(client, container);

    // 월말 세금 스케줄러 시작
    startMonthlyTaxScheduler(client, container);

    // Register all guilds the bot is currently in
    const pool = getPool();
    for (const [guildId, guild] of c.guilds.cache) {
      try {
        await pool.query(
          `INSERT INTO guilds (id, name, icon_url, owner_id, joined_at)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             icon_url = VALUES(icon_url),
             owner_id = VALUES(owner_id),
             left_at = NULL`,
          [
            guildId,
            guild.name,
            guild.iconURL(),
            guild.ownerId,
          ]
        );
        console.log(`📝 Registered guild: ${guild.name} (${guildId})`);

        // 기존 멤버 지갑/XP 초기화 (INSERT IGNORE로 이미 있으면 무시)
        const members = await guild.members.fetch();
        let initialized = 0;
        for (const [memberId, member] of members) {
          if (member.user.bot) continue;
          try {
            await container.currencyService.initializeWallet(guildId, memberId);
            await container.xpService.initializeUser(guildId, memberId);
            initialized++;
          } catch {
            // 개별 멤버 실패는 무시
          }
        }
        console.log(`👥 Initialized ${initialized} members in ${guild.name}`);
      } catch (err) {
        console.error(`Failed to register guild ${guildId}:`, err);
      }
    }
  });

  // Guild join event
  client.on(Events.GuildCreate, async (guild) => {
    console.log(`➕ Joined guild: ${guild.name} (${guild.id})`);
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO guilds (id, name, icon_url, owner_id, joined_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           icon_url = VALUES(icon_url),
           owner_id = VALUES(owner_id),
           left_at = NULL`,
        [
          guild.id,
          guild.name,
          guild.iconURL(),
          guild.ownerId,
        ]
      );
    } catch (err) {
      console.error(`Failed to register guild ${guild.id}:`, err);
    }
  });

  // Guild leave event
  client.on(Events.GuildDelete, async (guild) => {
    console.log(`➖ Left guild: ${guild.name} (${guild.id})`);
    const pool = getPool();
    try {
      await pool.query(
        `UPDATE guilds SET left_at = NOW() WHERE id = ?`,
        [guild.id]
      );
    } catch (err) {
      console.error(`Failed to update guild ${guild.id}:`, err);
    }
  });

  // Member join event - 신규 유저 지갑/XP 초기화
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;

    const guildId = member.guild.id;
    const userId = member.id;

    console.log(`👋 New member joined: ${member.user.tag} in ${member.guild.name}`);

    try {
      // 지갑 초기화
      const walletResult = await container.currencyService.initializeWallet(guildId, userId);
      if (walletResult.success) {
        console.log(`[INIT] Wallet initialized for ${userId} in ${guildId}`);
      } else {
        console.error(`[INIT] Failed to initialize wallet:`, walletResult.error);
      }

      // XP 초기화
      const xpResult = await container.xpService.initializeUser(guildId, userId);
      if (xpResult.success) {
        console.log(`[INIT] XP initialized for ${userId} in ${guildId}`);
      } else {
        console.error(`[INIT] Failed to initialize XP:`, xpResult.error);
      }
    } catch (err) {
      console.error(`[INIT] Error initializing user ${userId}:`, err);
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId) return;

    const roleIds = message.member?.roles.cache.map(r => r.id) ?? [];

    // XP 처리
    await xpHandler.handleTextMessage(
      message.guildId,
      message.author.id,
      message.channelId,
      roleIds
    );

    // 화폐 처리
    await currencyHandler.handleTextMessage(
      message.guildId,
      message.author.id,
      message.channelId,
      roleIds,
      message.content.length
    );
  });

  // Voice state update - track users joining/leaving voice channels
  client.on(Events.VoiceStateUpdate, (oldState: VoiceState, newState: VoiceState) => {
    const userId = newState.id;
    const guildId = newState.guild.id;
    const key = `${guildId}:${userId}`;

    // User left voice channel
    if (oldState.channelId && !newState.channelId) {
      voiceUsers.delete(key);
      console.log(`[VOICE] ${userId} left voice channel`);
      return;
    }

    // User joined voice channel
    if (newState.channelId && !oldState.channelId) {
      const member = newState.member;
      if (!member || member.user.bot) return;

      voiceUsers.set(key, {
        guildId,
        channelId: newState.channelId,
        roleIds: member.roles.cache.map(r => r.id),
        joinedAt: new Date(),
      });
      console.log(`[VOICE] ${userId} joined voice channel ${newState.channelId}`);
      return;
    }

    // User switched channels
    if (newState.channelId && oldState.channelId && newState.channelId !== oldState.channelId) {
      const existing = voiceUsers.get(key);
      if (existing) {
        existing.channelId = newState.channelId;
      }
      console.log(`[VOICE] ${userId} switched to channel ${newState.channelId}`);
    }
  });

  // Voice XP interval - give XP to users in voice channels every minute
  const VOICE_XP_INTERVAL = 60 * 1000; // 1 minute
  setInterval(async () => {
    for (const [key, data] of voiceUsers.entries()) {
      const [guildId, oderId] = key.split(':');
      const userId = oderId; // Fix variable name
      if (!guildId || !userId) continue;

      try {
        // Check if user is still in the voice channel and not muted/deafened
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        const voiceState = member.voice;

        // Skip if user is not in a voice channel, is self-muted, self-deafened, or alone
        if (!voiceState.channelId) {
          voiceUsers.delete(key);
          continue;
        }

        // Check if there are other non-bot members in the channel
        const channel = voiceState.channel;
        if (!channel) continue;

        const nonBotMembers = channel.members.filter(m => !m.user.bot);
        if (nonBotMembers.size < 2) {
          // User is alone in the channel, don't give XP
          continue;
        }

        // Give voice XP
        await xpHandler.handleVoiceXp(
          guildId,
          userId,
          data.channelId,
          data.roleIds
        );

        // Give voice currency
        await currencyHandler.handleVoiceReward(
          guildId,
          userId,
          data.channelId,
          data.roleIds
        );
      } catch (err) {
        console.error(`[VOICE XP] Error processing ${key}:`, err);
      }
    }
  }, VOICE_XP_INTERVAL);

  // Interaction handler (commands, buttons, modals)
  client.on(Events.InteractionCreate, async (interaction) => {
    // Autocomplete handler
    if (interaction.isAutocomplete()) {
      const command = commandCollection.get(interaction.commandName);
      if (!command?.autocomplete) return;

      try {
        await command.autocomplete(interaction, container);
      } catch (error) {
        console.error(`[AUTOCOMPLETE] Error for ${interaction.commandName}:`, error);
      }
      return;
    }

    // Slash command handler
    if (interaction.isChatInputCommand()) {
      const command = commandCollection.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, container);
      } catch (error) {
        console.error(`[COMMAND] Error executing ${interaction.commandName}:`, error);

        const reply = {
          content: '명령어 실행 중 오류가 발생했습니다.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    // Button handler
    if (interaction.isButton()) {
      const customId = interaction.customId;

      try {
        // 상점 패널 버튼
        if (customId === 'shop_panel_open') {
          await handleShopPanelButton(interaction, container);
          return;
        }

        // 토피 상점 패널 버튼
        if (customId === 'shop_topy_panel_open') {
          await handleTopyShopPanelButton(interaction, container);
          return;
        }

        // 루비 상점 패널 버튼
        if (customId === 'shop_ruby_panel_open') {
          await handleRubyShopPanelButton(interaction, container);
          return;
        }

        // 장터 패널 버튼
        if (customId === 'market_panel_list') {
          await handleMarketPanelList(interaction, container);
          return;
        }
        if (customId === 'market_panel_register') {
          await handleMarketPanelRegister(interaction, container);
          return;
        }
        if (customId === 'market_panel_my') {
          await handleMarketPanelMy(interaction, container);
          return;
        }

        // 게임센터 패널 버튼
        if (customId === 'game_panel_create') {
          await handleGamePanelCreate(interaction, container);
          return;
        }

        // 내전 참가 버튼
        if (customId.startsWith('game_join_')) {
          const gameId = BigInt(customId.replace('game_join_', ''));
          await handleGameJoin(interaction, container, gameId);
          return;
        }

        // 내전 참가 취소 버튼
        if (customId.startsWith('game_leave_')) {
          const gameId = BigInt(customId.replace('game_leave_', ''));
          await handleGameLeave(interaction, container, gameId);
          return;
        }

        // 팀 배정 버튼 (관리자)
        if (customId.startsWith('game_team_assign_')) {
          const gameId = BigInt(customId.replace('game_team_assign_', ''));
          await handleGameTeamAssign(interaction, container, gameId);
          return;
        }

        // 경기 시작 버튼 (관리자)
        if (customId.startsWith('game_start_')) {
          const gameId = BigInt(customId.replace('game_start_', ''));
          await handleGameStart(interaction, container, gameId);
          return;
        }

        // 게임 결과 입력 버튼 (관리자)
        if (customId.startsWith('game_result_') && !customId.includes('rank')) {
          const gameId = BigInt(customId.replace('game_result_', ''));
          await handleGameResult(interaction, container, gameId);
          return;
        }

        // 경기 취소 버튼 (관리자)
        if (customId.startsWith('game_cancel_')) {
          const gameId = BigInt(customId.replace('game_cancel_', ''));
          await handleGameCancel(interaction, container, gameId);
          return;
        }
      } catch (error) {
        console.error(`[BUTTON] Error handling ${customId}:`, error);

        const reply = {
          content: '버튼 처리 중 오류가 발생했습니다.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    // Modal submit handler
    if (interaction.isModalSubmit()) {
      const customId = interaction.customId;

      try {
        // 장터 등록 모달
        if (customId.startsWith('market_panel_register_modal_')) {
          await handleMarketPanelRegisterModal(interaction, container);
          return;
        }

        // 게임 생성 모달
        if (customId.startsWith('game_create_modal_')) {
          await handleGameCreateModal(interaction, container);
          return;
        }
      } catch (error) {
        console.error(`[MODAL] Error handling ${customId}:`, error);

        const reply = {
          content: '모달 처리 중 오류가 발생했습니다.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    // String select menu handler
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      try {
        // 장터 목록 선택 - 상품 상세 보기 등 추가 핸들러 필요시 여기에 추가

        // 게임 카테고리 선택
        if (customId.startsWith('game_create_category_')) {
          await handleGameCategorySelect(interaction, container);
          return;
        }

        // 게임 팀 선택 (팀 배정 시 어느 팀에 배정할지)
        if (customId.startsWith('game_team_select_')) {
          await handleGameTeamSelect(interaction, container);
          return;
        }

        // 게임 결과 순위 선택
        if (customId.startsWith('game_result_rank_')) {
          await handleGameResultRank(interaction, container);
          return;
        }
      } catch (error) {
        console.error(`[SELECT] Error handling ${customId}:`, error);
      }
      return;
    }

    // User select menu handler
    if (interaction.isUserSelectMenu()) {
      const customId = interaction.customId;

      try {
        // 게임 팀 유저 선택 (팀에 배정할 유저들)
        if (customId.startsWith('game_team_users_')) {
          await handleGameTeamUsers(interaction, container);
          return;
        }
      } catch (error) {
        console.error(`[USER_SELECT] Error handling ${customId}:`, error);
      }
      return;
    }
  });

  // Login
  await client.login(token);

  // HTTP Server for web notifications
  const app = express();
  app.use(express.json());

  // 채널 잠금 엔드포인트 (해금 채널 등록 시 @everyone 권한 제거)
  app.post('/api/channels/lock', async (req, res) => {
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ error: 'guildId and channelId are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !('permissionOverwrites' in channel)) {
        return res.status(404).json({ error: 'Channel not found or not a text channel' });
      }

      // @everyone 역할에 ViewChannel 권한 거부
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        ViewChannel: false,
      });

      console.log(`[LEVEL CHANNEL] Locked channel ${channel.name} (${channelId}) in guild ${guildId}`);
      return res.json({ success: true });
    } catch (error) {
      console.error('[LEVEL CHANNEL] Failed to lock channel:', error);
      return res.status(500).json({ error: 'Failed to lock channel' });
    }
  });

  // 다중 유저 채널 해금 엔드포인트 (소급 적용)
  app.post('/api/channels/unlock-for-users', async (req, res) => {
    const { guildId, channelId, userIds } = req.body;

    if (!guildId || !channelId || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'guildId, channelId, and userIds are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel || !('permissionOverwrites' in channel)) {
        return res.status(404).json({ error: 'Channel not found or not a text channel' });
      }

      let unlocked = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const member = await guild.members.fetch(userId);
          await channel.permissionOverwrites.create(member, {
            ViewChannel: true,
          });
          unlocked++;
        } catch (err) {
          console.error(`[LEVEL CHANNEL] Failed to unlock for user ${userId}:`, err);
          failed++;
        }
      }

      console.log(`[LEVEL CHANNEL] Retroactive unlock: ${unlocked} users unlocked, ${failed} failed for channel ${channel.name}`);
      return res.json({ success: true, unlocked, failed });
    } catch (error) {
      console.error('[LEVEL CHANNEL] Failed to unlock for users:', error);
      return res.status(500).json({ error: 'Failed to unlock channel for users' });
    }
  });

  // 설정 변경 알림 엔드포인트 (범용)
  app.post('/api/notify/settings-changed', async (req, res) => {
    const { guildId, type, action, details } = req.body;

    if (!guildId || !type) {
      return res.status(400).json({ error: 'guildId and type are required' });
    }

    const actionText = action || '변경';
    const typeLabels: Record<string, string> = {
      'xp-settings': 'XP 설정',
      'xp-text': '텍스트 XP',
      'xp-voice': '음성 XP',
      'xp-exclusion': 'XP 차단',
      'xp-hottime': 'XP 핫타임',
      'xp-reward': '레벨 보상',
      'xp-notification': '레벨업 알림',
      'xp-level-requirement': '레벨 설정',
      'xp-level-channel': '해금 채널',
      'currency-settings': '화폐 설정',
      'currency-exclusion': '화폐 차단',
      'currency-hottime': '화폐 핫타임',
      'currency-multiplier': '화폐 배율',
      'currency-channel-category': '채널 카테고리',
      'currency-manager': '화폐 관리자',
    };

    const typeLabel = typeLabels[type] || type;
    console.log(`[SETTINGS] ${typeLabel} ${actionText} - Guild: ${guildId}`);

    if (details) {
      console.log(`[SETTINGS] 상세: ${details}`);
    }

    // 레벨 설정 또는 역할 보상 변경 시 모든 유저의 레벨과 역할 동기화
    if (type === 'xp-level-requirement' || type === 'xp-reward') {
      console.log(`[SETTINGS] ${typeLabel} 변경 감지 - 역할 동기화 시작...`);
      const syncResult = await xpHandler.syncAllUserLevelsAndRewards(guildId);
      console.log(`[SETTINGS] 역할 동기화 완료: ${syncResult.updatedCount}/${syncResult.totalUsers}명 업데이트`);

      // 레벨 변경에 따른 해금 채널 권한도 동기화
      console.log(`[SETTINGS] 레벨 변경에 따른 채널 권한 동기화 시작...`);
      const channelSyncResult = await xpHandler.syncAllChannelPermissions(guildId);
      console.log(`[SETTINGS] 채널 동기화 완료: ${channelSyncResult.lockedChannels}개 채널 잠금, ${channelSyncResult.totalPermissionsSet}개 권한 설정`);
    }

    // 해금 채널 변경 시 채널 권한 동기화
    if (type === 'xp-level-channel') {
      console.log(`[SETTINGS] ${typeLabel} 변경 감지 - 채널 권한 동기화 시작...`);
      const channelSyncResult = await xpHandler.syncAllChannelPermissions(guildId);
      console.log(`[SETTINGS] 채널 동기화 완료: ${channelSyncResult.lockedChannels}개 채널 잠금, ${channelSyncResult.totalPermissionsSet}개 권한 설정`);
    }

    return res.json({ success: true });
  });

  // 장터 패널 생성 엔드포인트
  app.post('/api/market/panel', async (req, res) => {
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ error: 'guildId and channelId are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // 텍스트 채널인지 확인
      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return res.status(400).json({ error: 'Channel must be a text channel' });
      }

      // 기존 설정 조회
      const marketSettingsResult = await container.marketSettingsService.getSettings(guildId);
      const marketSettings = marketSettingsResult.success ? marketSettingsResult.data : null;

      // 기존 패널 메시지 삭제 (채널 변경 시)
      if (marketSettings?.channelId && marketSettings?.messageId) {
        try {
          const oldChannel = await guild.channels.fetch(marketSettings.channelId);
          if (oldChannel && 'messages' in oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(marketSettings.messageId);
            if (oldMessage) {
              await oldMessage.delete();
              console.log(`[MARKET] Deleted old panel message in channel ${marketSettings.channelId}`);
            }
          }
        } catch (err) {
          // 기존 메시지 삭제 실패는 무시 (이미 삭제됐을 수 있음)
          console.log(`[MARKET] Could not delete old panel message: ${err}`);
        }
      }

      // 화폐 설정 조회
      const currencySettingsResult = await container.currencyService.getSettings(guildId);
      const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';
      const rubyName = (currencySettingsResult.success && currencySettingsResult.data?.rubyName) || '루비';

      // 수수료율 (설정에서 가져오기)
      const topyFeePercent = marketSettings?.topyFeePercent ?? 5;
      const rubyFeePercent = marketSettings?.rubyFeePercent ?? 3;

      // 패널 Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛒 토피아 장터')
        .setDescription(
          '재능과 서비스를 자유롭게 거래하세요!\n\n' +
          '아래 버튼을 클릭하여 장터를 이용할 수 있습니다.'
        )
        .addFields(
          { name: `💰 ${topyName} 수수료`, value: `${topyFeePercent}%`, inline: true },
          { name: `💎 ${rubyName} 수수료`, value: `${rubyFeePercent}%`, inline: true },
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

      // 채널에 패널 메시지 전송
      const message = await channel.send({
        embeds: [embed],
        components: [buttonRow],
      });

      // 설정에 채널/메시지 ID 저장
      await container.marketSettingsService.updatePanel(guildId, channelId, message.id);

      console.log(`[MARKET] Panel created in channel ${channel.name} (${channelId}) in guild ${guildId}`);
      return res.json({ success: true, messageId: message.id });
    } catch (error) {
      console.error('[MARKET] Failed to create panel:', error);
      return res.status(500).json({ error: 'Failed to create market panel' });
    }
  });

  // 상점 패널 생성 엔드포인트
  app.post('/api/shop/panel', async (req, res) => {
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ error: 'guildId and channelId are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // 텍스트 채널인지 확인
      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return res.status(400).json({ error: 'Channel must be a text channel' });
      }

      // 기존 설정 조회
      const currencySettingsResult = await container.currencyService.getSettings(guildId);
      const currencySettings = currencySettingsResult.success ? currencySettingsResult.data : null;

      // 기존 패널 메시지 삭제 (채널 변경 시)
      if (currencySettings?.shopChannelId && currencySettings?.shopMessageId) {
        try {
          const oldChannel = await guild.channels.fetch(currencySettings.shopChannelId);
          if (oldChannel && 'messages' in oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(currencySettings.shopMessageId);
            if (oldMessage) {
              await oldMessage.delete();
              console.log(`[SHOP] Deleted old panel message in channel ${currencySettings.shopChannelId}`);
            }
          }
        } catch (err) {
          // 기존 메시지 삭제 실패는 무시 (이미 삭제됐을 수 있음)
          console.log(`[SHOP] Could not delete old panel message: ${err}`);
        }
      }

      // 화폐 설정 조회
      const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';
      const rubyName = (currencySettingsResult.success && currencySettingsResult.data?.rubyName) || '루비';

      // 패널 Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🛒 상점')
        .setDescription(
          '아이템을 구매하여 다양한 혜택을 누려보세요!\n\n' +
          `💰 **${topyName}** 또는 💎 **${rubyName}**로 아이템을 구매할 수 있습니다.\n` +
          '구매한 아이템은 `/인벤토리` 명령어에서 확인할 수 있습니다.'
        )
        .setFooter({ text: '아래 버튼을 눌러 상점을 열어보세요!' })
        .setTimestamp();

      // 버튼 생성
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_panel_open')
          .setLabel('상점 열기')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛒')
      );

      // 채널에 패널 메시지 전송
      const message = await channel.send({
        embeds: [embed],
        components: [buttonRow],
      });

      // 설정에 채널/메시지 ID 저장
      if (currencySettings) {
        currencySettings.shopChannelId = channelId;
        currencySettings.shopMessageId = message.id;
        currencySettings.updatedAt = new Date();
        const saveResult = await container.currencyService.saveSettings(currencySettings);
        if (saveResult.success) {
          console.log(`[SHOP] Saved panel info: channel=${channelId}, message=${message.id}`);
        } else {
          console.error(`[SHOP] Failed to save panel info:`, saveResult.error);
        }
      } else {
        // 설정이 없으면 새로 생성
        const newSettings = {
          guildId,
          shopChannelId: channelId,
          shopMessageId: message.id,
        };
        const saveResult = await container.currencyService.saveSettings(newSettings as any);
        if (saveResult.success) {
          console.log(`[SHOP] Created new settings with panel info: channel=${channelId}, message=${message.id}`);
        } else {
          console.error(`[SHOP] Failed to create settings:`, saveResult.error);
        }
      }

      console.log(`[SHOP] Panel created in channel ${channel.name} (${channelId}) in guild ${guildId}`);
      return res.json({ success: true, messageId: message.id });
    } catch (error) {
      console.error('[SHOP] Failed to create panel:', error);
      return res.status(500).json({ error: 'Failed to create shop panel' });
    }
  });

  // 상점 패널 메시지 업데이트 (화폐 설정 변경 시)
  app.post('/api/shop/panel/refresh', async (req, res) => {
    const { guildId } = req.body;

    if (!guildId) {
      return res.status(400).json({ error: 'guildId is required' });
    }

    try {
      // 설정 조회
      const currencySettingsResult = await container.currencyService.getSettings(guildId);
      if (!currencySettingsResult.success || !currencySettingsResult.data) {
        return res.status(404).json({ error: 'Currency settings not found' });
      }

      const currencySettings = currencySettingsResult.data;
      const { shopChannelId, shopMessageId, topyName, rubyName } = currencySettings;

      const guild = await client.guilds.fetch(guildId);
      const results: { type: string; success: boolean; reason?: string }[] = [];

      // 1. 기존 통합 패널 업데이트
      if (shopChannelId && shopMessageId) {
        try {
          const channel = await guild.channels.fetch(shopChannelId);
          if (channel && 'messages' in channel) {
            const message = await channel.messages.fetch(shopMessageId);
            const embed = new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🛒 상점')
              .setDescription(
                '아이템을 구매하여 다양한 혜택을 누려보세요!\n\n' +
                `💰 **${topyName || '토피'}** 또는 💎 **${rubyName || '루비'}**로 아이템을 구매할 수 있습니다.\n` +
                '구매한 아이템은 `/인벤토리` 명령어에서 확인할 수 있습니다.'
              )
              .setFooter({ text: '아래 버튼을 눌러 상점을 열어보세요!' })
              .setTimestamp();
            await message.edit({ embeds: [embed] });
            results.push({ type: 'combined', success: true });
          }
        } catch {
          results.push({ type: 'combined', success: false, reason: 'Message not found' });
        }
      }

      // 2. 토피 패널 업데이트
      const topyPanelResult = await container.shopPanelService.getSettings(guildId, 'topy');
      if (topyPanelResult.success && topyPanelResult.data?.channelId && topyPanelResult.data?.messageId) {
        try {
          const channel = await guild.channels.fetch(topyPanelResult.data.channelId);
          if (channel && 'messages' in channel) {
            const message = await channel.messages.fetch(topyPanelResult.data.messageId);
            const embed = new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle(`💰 ${topyName || '토피'} 상점`)
              .setDescription(
                `아이템을 구매하여 다양한 혜택을 누려보세요!\n\n` +
                `💰 **${topyName || '토피'}**로 아이템을 구매할 수 있습니다.\n` +
                '구매한 아이템은 `/인벤토리` 명령어에서 확인할 수 있습니다.'
              )
              .setFooter({ text: '아래 버튼을 눌러 상점을 열어보세요!' })
              .setTimestamp();
            await message.edit({ embeds: [embed] });
            results.push({ type: 'topy', success: true });
          }
        } catch {
          results.push({ type: 'topy', success: false, reason: 'Message not found' });
        }
      }

      // 3. 루비 패널 업데이트
      const rubyPanelResult = await container.shopPanelService.getSettings(guildId, 'ruby');
      if (rubyPanelResult.success && rubyPanelResult.data?.channelId && rubyPanelResult.data?.messageId) {
        try {
          const channel = await guild.channels.fetch(rubyPanelResult.data.channelId);
          if (channel && 'messages' in channel) {
            const message = await channel.messages.fetch(rubyPanelResult.data.messageId);
            const embed = new EmbedBuilder()
              .setColor(0xE91E63)
              .setTitle(`💎 ${rubyName || '루비'} 상점`)
              .setDescription(
                `아이템을 구매하여 다양한 혜택을 누려보세요!\n\n` +
                `💎 **${rubyName || '루비'}**로 아이템을 구매할 수 있습니다.\n` +
                '구매한 아이템은 `/인벤토리` 명령어에서 확인할 수 있습니다.'
              )
              .setFooter({ text: '아래 버튼을 눌러 상점을 열어보세요!' })
              .setTimestamp();
            await message.edit({ embeds: [embed] });
            results.push({ type: 'ruby', success: true });
          }
        } catch {
          results.push({ type: 'ruby', success: false, reason: 'Message not found' });
        }
      }

      // 4. 장터 패널 업데이트
      const marketSettingsResult = await container.marketSettingsService.getSettings(guildId);
      if (marketSettingsResult.success && marketSettingsResult.data?.channelId && marketSettingsResult.data?.messageId) {
        try {
          const channel = await guild.channels.fetch(marketSettingsResult.data.channelId);
          if (channel && 'messages' in channel) {
            const message = await channel.messages.fetch(marketSettingsResult.data.messageId);
            const marketSettings = marketSettingsResult.data;
            const topyFeePercent = marketSettings.topyFeePercent ?? 5;
            const rubyFeePercent = marketSettings.rubyFeePercent ?? 3;

            const embed = new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('🛒 토피아 장터')
              .setDescription(
                '재능과 서비스를 자유롭게 거래하세요!\n\n' +
                '아래 버튼을 클릭하여 장터를 이용할 수 있습니다.'
              )
              .addFields(
                { name: `💰 ${topyName || '토피'} 수수료`, value: `${topyFeePercent}%`, inline: true },
                { name: `💎 ${rubyName || '루비'} 수수료`, value: `${rubyFeePercent}%`, inline: true },
                { name: '⏰ 등록 유효기간', value: '30일', inline: true }
              )
              .setFooter({ text: '거래 시 발생하는 분쟁은 관리자에게 문의하세요.' })
              .setTimestamp();
            await message.edit({ embeds: [embed] });
            results.push({ type: 'market', success: true });
          }
        } catch {
          results.push({ type: 'market', success: false, reason: 'Message not found' });
        }
      }

      if (results.length === 0) {
        return res.json({ success: true, skipped: true, reason: 'No panel installed' });
      }

      console.log(`[SHOP] Panels refreshed in guild ${guildId}:`, results);
      return res.json({ success: true, results });
    } catch (error) {
      console.error('[SHOP] Failed to refresh panel:', error);
      return res.status(500).json({ error: 'Failed to refresh shop panel' });
    }
  });

  // 토피 상점 패널 생성 엔드포인트
  app.post('/api/shop/topy/panel', async (req, res) => {
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ error: 'guildId and channelId are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return res.status(400).json({ error: 'Channel must be a text channel' });
      }

      // 기존 설정 조회
      const settingsResult = await container.shopPanelService.getSettings(guildId, 'topy');
      const settings = settingsResult.success ? settingsResult.data : null;

      // 기존 패널 메시지 삭제
      if (settings?.channelId && settings?.messageId) {
        try {
          const oldChannel = await guild.channels.fetch(settings.channelId);
          if (oldChannel && 'messages' in oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(settings.messageId);
            if (oldMessage) {
              await oldMessage.delete();
              console.log(`[SHOP-TOPY] Deleted old panel message in channel ${settings.channelId}`);
            }
          }
        } catch (err) {
          console.log(`[SHOP-TOPY] Could not delete old panel message: ${err}`);
        }
      }

      // 화폐 설정 조회
      const currencySettingsResult = await container.currencyService.getSettings(guildId);
      const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

      // 패널 Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0xFFD700) // 금색
        .setTitle(`💰 ${topyName} 상점`)
        .setDescription(
          `${topyName}로 구매할 수 있는 아이템입니다.\n\n` +
          '📦 아래 버튼을 눌러 아이템 목록을 확인하세요.\n' +
          '구매한 아이템은 `/인벤토리` 명령어에서 사용할 수 있습니다.'
        )
        .setFooter({ text: `${topyName}로 결제됩니다.` })
        .setTimestamp();

      // 버튼 생성
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_topy_panel_open')
          .setLabel('상점 열기')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰')
      );

      // 채널에 패널 메시지 전송
      const message = await channel.send({
        embeds: [embed],
        components: [buttonRow],
      });

      // 설정에 채널/메시지 ID 저장
      await container.shopPanelService.updatePanel(guildId, 'topy', channelId, message.id);

      console.log(`[SHOP-TOPY] Panel created in channel ${channel.name} (${channelId}) in guild ${guildId}`);
      return res.json({ success: true, messageId: message.id });
    } catch (error) {
      console.error('[SHOP-TOPY] Failed to create panel:', error);
      return res.status(500).json({ error: 'Failed to create topy shop panel' });
    }
  });

  // 루비 상점 패널 생성 엔드포인트
  app.post('/api/shop/ruby/panel', async (req, res) => {
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ error: 'guildId and channelId are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return res.status(400).json({ error: 'Channel must be a text channel' });
      }

      // 기존 설정 조회
      const settingsResult = await container.shopPanelService.getSettings(guildId, 'ruby');
      const settings = settingsResult.success ? settingsResult.data : null;

      // 기존 패널 메시지 삭제
      if (settings?.channelId && settings?.messageId) {
        try {
          const oldChannel = await guild.channels.fetch(settings.channelId);
          if (oldChannel && 'messages' in oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(settings.messageId);
            if (oldMessage) {
              await oldMessage.delete();
              console.log(`[SHOP-RUBY] Deleted old panel message in channel ${settings.channelId}`);
            }
          }
        } catch (err) {
          console.log(`[SHOP-RUBY] Could not delete old panel message: ${err}`);
        }
      }

      // 화폐 설정 조회
      const currencySettingsResult = await container.currencyService.getSettings(guildId);
      const rubyName = (currencySettingsResult.success && currencySettingsResult.data?.rubyName) || '루비';

      // 패널 Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0xE91E63) // 분홍색
        .setTitle(`💎 ${rubyName} 상점`)
        .setDescription(
          `${rubyName}로 구매할 수 있는 프리미엄 아이템입니다.\n\n` +
          '📦 아래 버튼을 눌러 아이템 목록을 확인하세요.\n' +
          '구매한 아이템은 `/인벤토리` 명령어에서 사용할 수 있습니다.'
        )
        .setFooter({ text: `${rubyName}로 결제됩니다.` })
        .setTimestamp();

      // 버튼 생성
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_ruby_panel_open')
          .setLabel('상점 열기')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💎')
      );

      // 채널에 패널 메시지 전송
      const message = await channel.send({
        embeds: [embed],
        components: [buttonRow],
      });

      // 설정에 채널/메시지 ID 저장
      await container.shopPanelService.updatePanel(guildId, 'ruby', channelId, message.id);

      console.log(`[SHOP-RUBY] Panel created in channel ${channel.name} (${channelId}) in guild ${guildId}`);
      return res.json({ success: true, messageId: message.id });
    } catch (error) {
      console.error('[SHOP-RUBY] Failed to create panel:', error);
      return res.status(500).json({ error: 'Failed to create ruby shop panel' });
    }
  });

  // 게임센터 패널 생성 엔드포인트
  app.post('/api/game/panel', async (req, res) => {
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ error: 'guildId and channelId are required' });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      // 텍스트 채널인지 확인
      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return res.status(400).json({ error: 'Channel must be a text channel' });
      }

      // 기존 설정 조회
      const gameSettingsResult = await container.gameService.getSettings(guildId);
      const gameSettings = gameSettingsResult.success ? gameSettingsResult.data : null;

      // 기존 패널 메시지 삭제 (채널 변경 시)
      if (gameSettings?.channelId && gameSettings?.messageId) {
        try {
          const oldChannel = await guild.channels.fetch(gameSettings.channelId);
          if (oldChannel && 'messages' in oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(gameSettings.messageId);
            if (oldMessage) {
              await oldMessage.delete();
              console.log(`[GAME] Deleted old panel message in channel ${gameSettings.channelId}`);
            }
          }
        } catch (err) {
          // 기존 메시지 삭제 실패는 무시
          console.log(`[GAME] Could not delete old panel message: ${err}`);
        }
      }

      // 화폐 설정 조회
      const currencySettingsResult = await container.currencyService.getSettings(guildId);
      const topyName = (currencySettingsResult.success && currencySettingsResult.data?.topyName) || '토피';

      // 게임 설정 조회
      const entryFee = gameSettings?.entryFee ?? 100n;
      const rankRewards = gameSettings?.rankRewards ?? { 1: 50, 2: 30, 3: 15, 4: 5 };

      // 보상 비율 문자열 생성 (동적 순위 지원)
      const rankRewardsText = Object.entries(rankRewards)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .filter(([, percent]) => percent > 0)
        .map(([rank, percent]) => `${rank}등 ${percent}%`)
        .join(' | ');

      // 패널 Embed 생성
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎮 내전 시스템')
        .setDescription(
          '참가비를 내고 내전에 참가하세요!\n\n' +
          `💰 **참가비**: ${entryFee.toLocaleString()} ${topyName}\n` +
          `🏆 **보상 비율**: ${rankRewardsText}`
        )
        .addFields(
          { name: '📋 참가 방법', value: '1. 내전 메시지에서 참가 버튼 클릭\n2. 참가비 자동 차감\n3. 관리자가 팀 배정\n4. 경기 후 순위 보상', inline: false }
        )
        .setFooter({ text: '관리자만 내전을 생성할 수 있습니다.' })
        .setTimestamp();

      // 버튼 생성
      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('game_panel_create')
          .setLabel('내전 생성하기')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮')
      );

      // 채널에 패널 메시지 전송
      const message = await channel.send({
        embeds: [embed],
        components: [buttonRow],
      });

      // 설정에 채널/메시지 ID 저장
      await container.gameService.updatePanel(guildId, channelId, message.id);

      console.log(`[GAME] Panel created in channel ${channel.name} (${channelId}) in guild ${guildId}`);
      return res.json({ success: true, messageId: message.id });
    } catch (error) {
      console.error('[GAME] Failed to create panel:', error);
      return res.status(500).json({ error: 'Failed to create game panel' });
    }
  });

  const BOT_API_PORT = parseInt(process.env['BOT_API_PORT'] || '3001');
  app.listen(BOT_API_PORT, () => {
    console.log(`📡 Bot API server running on port ${BOT_API_PORT}`);
  });
}

main().catch(console.error);
