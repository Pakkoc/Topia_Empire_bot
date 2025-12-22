import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, Events, VoiceState } from 'discord.js';
import { createPool, createRedisClient, createContainer, getPool } from '@topia/infra';
import { createXpHandler } from './handlers/xp.handler';
import { createCurrencyHandler } from './handlers/currency.handler';

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

  // Events
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Bot ready! Logged in as ${c.user.tag}`);

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

  // Login
  const token = process.env['DISCORD_TOKEN'];
  if (!token) {
    throw new Error('DISCORD_TOKEN is required');
  }

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

  const BOT_API_PORT = parseInt(process.env['BOT_API_PORT'] || '3001');
  app.listen(BOT_API_PORT, () => {
    console.log(`📡 Bot API server running on port ${BOT_API_PORT}`);
  });
}

main().catch(console.error);
