import type { Client, TextChannel } from 'discord.js';
import type { Container } from '@topia/infra';
import type { RowDataPacket } from 'mysql2';
import { EmbedBuilder } from 'discord.js';
import { getPool } from '@topia/infra';

interface GuildRow extends RowDataPacket {
  id: string;
}

interface LogChannelRow extends RowDataPacket {
  log_channel_id: string | null;
}

// 매 시간마다 체크 (매일 23시에 마지막 날인지 확인)
const TAX_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * 월말 세금 자동 차감 스케줄러
 */
export function startMonthlyTaxScheduler(client: Client, container: Container) {
  console.log('[SCHEDULER] Starting monthly tax scheduler (check every 1 hour)');

  // 주기적으로 실행
  setInterval(() => {
    checkAndProcessMonthlyTax(client, container);
  }, TAX_CHECK_INTERVAL);
}

/**
 * 오늘이 월말인지 체크하고 세금 처리
 */
async function checkAndProcessMonthlyTax(client: Client, container: Container) {
  const now = new Date();
  const hour = now.getHours();

  // 23시에만 실행
  if (hour !== 23) {
    return;
  }

  // 오늘이 이번 달의 마지막 날인지 확인
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isLastDayOfMonth = tomorrow.getDate() === 1;

  if (!isLastDayOfMonth) {
    return;
  }

  console.log('[MONTHLY TAX] Last day of month detected at 23:00. Processing taxes...');

  // 모든 길드에 대해 세금 처리
  const pool = getPool();
  const [guilds] = await pool.query<GuildRow[]>(
    'SELECT id FROM guilds WHERE left_at IS NULL'
  );

  for (const { id: guildId } of guilds) {
    await processGuildTax(client, container, guildId);
  }
}

/**
 * 특정 길드의 월말 세금 처리
 */
async function processGuildTax(client: Client, container: Container, guildId: string) {
  try {
    const result = await container.taxService.processMonthlyTax(guildId);

    if (!result.success) {
      if (result.error.type === 'ALREADY_PROCESSED') {
        console.log(`[MONTHLY TAX] Guild ${guildId}: Already processed this month`);
        return;
      }
      console.error(`[MONTHLY TAX] Guild ${guildId}: Failed to process -`, result.error);
      return;
    }

    const summary = result.data;

    // 세금이 비활성화되어 있거나 처리할 유저가 없으면 스킵
    if (summary.taxedUsers === 0 && summary.exemptedUsers === 0) {
      console.log(`[MONTHLY TAX] Guild ${guildId}: Tax disabled or no users to process`);
      return;
    }

    console.log(
      `[MONTHLY TAX] Guild ${guildId}: Processed ${summary.taxedUsers} users, ` +
        `exempted ${summary.exemptedUsers}, total tax: ${summary.totalTaxAmount}`
    );

    // 세금 처리 완료 알림 전송 (선택적)
    await sendTaxNotification(client, guildId, summary);
  } catch (err) {
    console.error(`[MONTHLY TAX] Guild ${guildId}: Error -`, err);
  }
}

/**
 * 세금 처리 완료 알림 전송
 */
async function sendTaxNotification(
  client: Client,
  guildId: string,
  summary: {
    processedAt: Date;
    totalUsers: number;
    taxedUsers: number;
    exemptedUsers: number;
    totalTaxAmount: bigint;
  }
) {
  try {
    // currency_settings에서 알림 채널 ID 조회
    const pool = getPool();
    const [rows] = await pool.query<LogChannelRow[]>(
      'SELECT log_channel_id FROM currency_settings WHERE guild_id = ?',
      [guildId]
    );

    const logChannelId = rows[0]?.log_channel_id;
    if (!logChannelId) return;

    const guild = await client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(logChannelId)) as TextChannel;
    if (!channel?.isTextBased()) return;

    const year = summary.processedAt.getFullYear();
    const month = summary.processedAt.getMonth() + 1;

    const embed = new EmbedBuilder()
      .setTitle('📊 월말 세금 처리 완료')
      .setDescription(`${year}년 ${month}월 세금이 자동으로 차감되었습니다.`)
      .addFields(
        { name: '처리 대상', value: `${summary.totalUsers}명`, inline: true },
        { name: '세금 납부', value: `${summary.taxedUsers}명`, inline: true },
        { name: '면제', value: `${summary.exemptedUsers}명`, inline: true },
        {
          name: '총 세금액',
          value: `${summary.totalTaxAmount.toLocaleString()} 토피`,
          inline: false,
        }
      )
      .setColor(0x4ade80)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    // 알림 전송 실패는 무시
    console.error(`[MONTHLY TAX] Failed to send notification for guild ${guildId}:`, err);
  }
}
