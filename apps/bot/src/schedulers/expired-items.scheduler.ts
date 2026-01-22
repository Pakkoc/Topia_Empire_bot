import { Client, EmbedBuilder } from 'discord.js';
import type { Container } from '@topia/infra';

const EXPIRED_ITEMS_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * 만료 알림 DM 전송
 */
async function sendExpirationDM(
  client: Client,
  userId: string,
  guildId: string,
  itemName: string,
  type: 'item' | 'role'
) {
  try {
    const user = await client.users.fetch(userId);
    const guild = await client.guilds.fetch(guildId);

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('⏰ 아이템 만료 알림')
      .setDescription(
        type === 'item'
          ? `**${guild.name}** 서버에서 구매하신 **${itemName}** 아이템이 만료되었습니다.`
          : `**${guild.name}** 서버에서 **${itemName}**의 역할 효과가 만료되었습니다.`
      )
      .addFields({
        name: '📌 안내',
        value: type === 'item'
          ? '아이템과 관련된 역할이 회수되었습니다. 계속 이용하시려면 상점에서 다시 구매해주세요.'
          : '역할이 회수되었습니다. 아이템은 유지되며, 인벤토리에서 다시 역할을 선택할 수 있습니다.',
      })
      .setTimestamp()
      .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined });

    await user.send({ embeds: [embed] });
    console.log(`[EXPIRED ITEMS] Sent expiration DM to user ${userId} for item "${itemName}"`);
  } catch (err) {
    // DM 전송 실패 (DM 차단 등)는 무시
    console.log(`[EXPIRED ITEMS] Failed to send DM to user ${userId}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * 만료된 기간제 아이템의 역할을 회수하는 스케줄러
 */
export function startExpiredItemsScheduler(client: Client, container: Container) {
  console.log('[SCHEDULER] Starting expired items scheduler (every 1 hour)');

  // 즉시 한 번 실행
  checkExpiredItems(client, container);

  // 주기적으로 실행
  setInterval(() => {
    checkExpiredItems(client, container);
  }, EXPIRED_ITEMS_CHECK_INTERVAL);
}

async function checkExpiredItems(client: Client, container: Container) {
  console.log('[EXPIRED ITEMS] Checking for expired items and roles...');

  try {
    // 1. 아이템 만료 체크 (기존 로직)
    await processExpiredItems(client, container);

    // 2. 역할 효과 만료 체크 (새로 추가)
    await processExpiredRoles(client, container);
  } catch (err) {
    console.error('[EXPIRED ITEMS] Scheduler error:', err);
  }
}

/**
 * 만료된 아이템 처리 (아이템 + 역할 함께 회수)
 */
async function processExpiredItems(client: Client, container: Container) {
  const result = await container.inventoryService.getExpiredItems();
  if (!result.success) {
    console.error('[EXPIRED ITEMS] Failed to get expired items:', result.error);
    return;
  }

  const expiredItems = result.data;
  if (expiredItems.length === 0) {
    console.log('[EXPIRED ITEMS] No expired items found');
    return;
  }

  console.log(`[EXPIRED ITEMS] Found ${expiredItems.length} expired items with roles to revoke`);

  let revokedCount = 0;
  let failedCount = 0;

  for (const { userItem, roleIdToRevoke, fixedRoleIdToRevoke } of expiredItems) {
    try {
      const guild = await client.guilds.fetch(userItem.guildId);
      const member = await guild.members.fetch(userItem.userId);

      // 상점 아이템 이름 조회
      const shopItemResult = await container.shopV2Service.getShopItem(userItem.shopItemId);
      const itemName = shopItemResult.success && shopItemResult.data ? shopItemResult.data.name : '알 수 없는 아이템';

      // 교환 역할 회수
      if (roleIdToRevoke && member.roles.cache.has(roleIdToRevoke)) {
        await member.roles.remove(roleIdToRevoke);
        console.log(`[EXPIRED ITEMS] Revoked role ${roleIdToRevoke} from user ${userItem.userId} in guild ${userItem.guildId}`);
      }

      // 고정 역할 회수
      if (fixedRoleIdToRevoke && member.roles.cache.has(fixedRoleIdToRevoke)) {
        await member.roles.remove(fixedRoleIdToRevoke);
        console.log(`[EXPIRED ITEMS] Revoked fixed role ${fixedRoleIdToRevoke} from user ${userItem.userId} in guild ${userItem.guildId}`);
      }

      // 아이템 만료 처리 (currentRoleId = null, fixedRoleId = null)
      const markResult = await container.inventoryService.markItemExpired(userItem.id);
      if (markResult.success) {
        revokedCount++;
        // 만료 알림 DM 전송
        await sendExpirationDM(client, userItem.userId, userItem.guildId, itemName, 'item');
      } else {
        console.error(`[EXPIRED ITEMS] Failed to mark item ${userItem.id} as expired:`, markResult.error);
        failedCount++;
      }
    } catch (err) {
      console.error(`[EXPIRED ITEMS] Error processing expired item ${userItem.id}:`, err);
      failedCount++;
    }
  }

  console.log(`[EXPIRED ITEMS] Completed: ${revokedCount} revoked, ${failedCount} failed`);
}

/**
 * 역할 효과 만료 처리 (역할만 회수, 아이템 유지)
 */
async function processExpiredRoles(client: Client, container: Container) {
  const result = await container.inventoryService.getRoleExpiredItems();
  if (!result.success) {
    console.error('[EXPIRED ROLES] Failed to get expired roles:', result.error);
    return;
  }

  const expiredItems = result.data;
  if (expiredItems.length === 0) {
    console.log('[EXPIRED ROLES] No expired role effects found');
    return;
  }

  console.log(`[EXPIRED ROLES] Found ${expiredItems.length} expired role effects`);

  let revokedCount = 0;
  let failedCount = 0;

  for (const { userItem, roleIdToRevoke, fixedRoleIdToRevoke } of expiredItems) {
    try {
      const guild = await client.guilds.fetch(userItem.guildId);
      const member = await guild.members.fetch(userItem.userId);

      // 상점 아이템 이름 조회
      const shopItemResult = await container.shopV2Service.getShopItem(userItem.shopItemId);
      const itemName = shopItemResult.success && shopItemResult.data ? shopItemResult.data.name : '알 수 없는 아이템';

      // 교환 역할 회수
      if (roleIdToRevoke && member.roles.cache.has(roleIdToRevoke)) {
        await member.roles.remove(roleIdToRevoke);
        console.log(`[EXPIRED ROLES] Revoked role ${roleIdToRevoke} from user ${userItem.userId} in guild ${userItem.guildId}`);
      }

      // 고정 역할 회수
      if (fixedRoleIdToRevoke && member.roles.cache.has(fixedRoleIdToRevoke)) {
        await member.roles.remove(fixedRoleIdToRevoke);
        console.log(`[EXPIRED ROLES] Revoked fixed role ${fixedRoleIdToRevoke} from user ${userItem.userId} in guild ${userItem.guildId}`);
      }

      // 역할 효과 만료 처리 (역할만 null, 아이템 유지)
      const markResult = await container.inventoryService.markRoleExpired(userItem.id);
      if (markResult.success) {
        revokedCount++;
        // 만료 알림 DM 전송
        await sendExpirationDM(client, userItem.userId, userItem.guildId, itemName, 'role');
      } else {
        console.error(`[EXPIRED ROLES] Failed to mark role expired for item ${userItem.id}:`, markResult.error);
        failedCount++;
      }
    } catch (err) {
      console.error(`[EXPIRED ROLES] Error processing expired role for item ${userItem.id}:`, err);
      failedCount++;
    }
  }

  console.log(`[EXPIRED ROLES] Completed: ${revokedCount} revoked, ${failedCount} failed`);
}
