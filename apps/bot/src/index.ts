import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { createPool, createRedisClient, createContainer } from '@topia/infra';
import { createXpHandler } from './handlers/xp.handler';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

async function main() {
  // Database 초기화
  createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'topia_empire',
  });

  // Redis 초기화
  createRedisClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  // DI Container 생성
  const container = createContainer();

  // Handlers 생성
  const xpHandler = createXpHandler(container);

  // Events
  client.once(Events.ClientReady, (c) => {
    console.log(`✅ Bot ready! Logged in as ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId) return;

    const roleIds = message.member?.roles.cache.map(r => r.id) ?? [];
    await xpHandler.handleTextMessage(
      message.guildId,
      message.author.id,
      message.channelId,
      roleIds
    );
  });

  // Login
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN is required');
  }

  await client.login(token);
}

main().catch(console.error);
