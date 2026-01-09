import type { Client, TextChannel } from 'discord.js';
import type { Container } from '@topia/infra';
import type { LevelRewardInfo } from '@topia/core';

const DEFAULT_LEVEL_UP_MESSAGE = '🎉 축하합니다 {user}님! **레벨 {level}**에 도달하셨습니다!';

export function createXpHandler(container: Container, client: Client) {
  return {
    async handleTextMessage(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[]
    ): Promise<void> {
      const result = await container.xpService.grantTextXp(
        guildId,
        userId,
        channelId,
        roleIds
      );

      if (!result.success) {
        console.error('XP grant error:', result.error);
        return;
      }

      if (result.data.granted) {
        console.log(
          `[XP] ${userId} earned ${result.data.xp} XP (total: ${result.data.totalXp}, level: ${result.data.level})`
        );

        if (result.data.leveledUp) {
          console.log(`[LEVEL UP] ${userId} reached level ${result.data.level}!`);

          // Apply level rewards (roles)
          await this.applyLevelRewards(
            guildId,
            userId,
            result.data.rolesToAdd,
            result.data.rolesToRemove
          );

          // Unlock channels
          await this.unlockChannels(
            guildId,
            userId,
            result.data.channelsToUnlock
          );

          // Send notification
          await this.sendLevelUpNotification(
            guildId,
            userId,
            result.data.level!,
            result.data.totalXp!,
            result.data.levelUpChannelId,
            result.data.levelUpMessage
          );
        }
      } else if (result.data.reason) {
        console.log(`[XP BLOCKED] ${userId} in channel ${channelId} - reason: ${result.data.reason}`);
      }
    },

    async unlockChannels(
      guildId: string,
      userId: string,
      channelsToUnlock?: string[]
    ): Promise<void> {
      if (!channelsToUnlock || channelsToUnlock.length === 0) {
        return;
      }

      try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        for (const channelId of channelsToUnlock) {
          try {
            const channel = await guild.channels.fetch(channelId);
            if (channel && 'permissionOverwrites' in channel) {
              await channel.permissionOverwrites.create(member, {
                ViewChannel: true,
                SendMessages: true,
              });
              console.log(`[LEVEL CHANNEL] Unlocked channel ${channelId} for ${userId}`);
            }
          } catch (err) {
            console.error(`[LEVEL CHANNEL] Failed to unlock channel ${channelId}:`, err);
          }
        }
      } catch (error) {
        console.error('[LEVEL CHANNEL] Failed to unlock channels:', error);
      }
    },

    async applyLevelRewards(
      guildId: string,
      userId: string,
      rolesToAdd?: LevelRewardInfo[],
      rolesToRemove?: string[]
    ): Promise<void> {
      if ((!rolesToAdd || rolesToAdd.length === 0) && (!rolesToRemove || rolesToRemove.length === 0)) {
        return;
      }

      try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);

        // Remove old roles
        if (rolesToRemove && rolesToRemove.length > 0) {
          for (const roleId of rolesToRemove) {
            try {
              await member.roles.remove(roleId);
              console.log(`[LEVEL REWARD] Removed role ${roleId} from ${userId}`);
            } catch (err) {
              console.error(`[LEVEL REWARD] Failed to remove role ${roleId}:`, err);
            }
          }
        }

        // Add new roles
        if (rolesToAdd && rolesToAdd.length > 0) {
          for (const reward of rolesToAdd) {
            try {
              await member.roles.add(reward.roleId);
              console.log(`[LEVEL REWARD] Added role ${reward.roleId} to ${userId}`);
            } catch (err) {
              console.error(`[LEVEL REWARD] Failed to add role ${reward.roleId}:`, err);
            }
          }
        }
      } catch (error) {
        console.error('[LEVEL REWARD] Failed to apply rewards:', error);
      }
    },

    async sendLevelUpNotification(
      guildId: string,
      userId: string,
      level: number,
      xp: number,
      levelUpChannelId?: string | null,
      customMessage?: string | null
    ): Promise<void> {
      if (!levelUpChannelId) {
        console.log('[LEVEL UP] No notification channel configured');
        return;
      }

      try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(levelUpChannelId);

        if (!channel || !channel.isTextBased()) {
          console.error('[LEVEL UP] Invalid channel or not a text channel');
          return;
        }

        const user = await client.users.fetch(userId);
        const member = await guild.members.fetch(userId);

        // Format the message with placeholders
        const messageTemplate = customMessage || DEFAULT_LEVEL_UP_MESSAGE;
        const formattedMessage = messageTemplate
          .replace(/{user}/g, `<@${userId}>`)
          .replace(/{username}/g, user.username)
          .replace(/{displayname}/g, member.displayName)
          .replace(/{level}/g, level.toString())
          .replace(/{xp}/g, xp.toLocaleString())
          .replace(/{server}/g, guild.name);

        await (channel as TextChannel).send(formattedMessage);
        console.log(`[LEVEL UP] Sent notification to channel ${levelUpChannelId}`);
      } catch (error) {
        console.error('[LEVEL UP] Failed to send notification:', error);
      }
    },

    async handleVoiceXp(
      guildId: string,
      userId: string,
      channelId: string,
      roleIds: string[]
    ): Promise<void> {
      const result = await container.xpService.grantVoiceXp(
        guildId,
        userId,
        channelId,
        roleIds
      );

      if (!result.success) {
        console.error('Voice XP grant error:', result.error);
        return;
      }

      if (result.data.granted) {
        console.log(
          `[VOICE XP] ${userId} earned ${result.data.xp} XP (total: ${result.data.totalXp}, level: ${result.data.level})`
        );

        if (result.data.leveledUp) {
          console.log(`[LEVEL UP] ${userId} reached level ${result.data.level}!`);

          // Apply level rewards (roles)
          await this.applyLevelRewards(
            guildId,
            userId,
            result.data.rolesToAdd,
            result.data.rolesToRemove
          );

          // Unlock channels
          await this.unlockChannels(
            guildId,
            userId,
            result.data.channelsToUnlock
          );

          // Send notification
          await this.sendLevelUpNotification(
            guildId,
            userId,
            result.data.level!,
            result.data.totalXp!,
            result.data.levelUpChannelId,
            result.data.levelUpMessage
          );
        }
      } else if (result.data.reason) {
        console.log(`[VOICE XP BLOCKED] ${userId} in channel ${channelId} - reason: ${result.data.reason}`);
      }
    },

    /**
     * 레벨 요구사항 변경 시 모든 유저의 레벨과 역할을 동기화합니다.
     */
    async syncAllUserLevelsAndRewards(guildId: string): Promise<{
      success: boolean;
      updatedCount: number;
      totalUsers: number;
    }> {
      console.log(`[SYNC] Starting level sync for guild ${guildId}...`);

      const result = await container.xpService.syncAllUserLevels(guildId);

      if (!result.success) {
        console.error('[SYNC] Failed to sync levels:', result.error);
        return { success: false, updatedCount: 0, totalUsers: 0 };
      }

      const { updatedUsers, totalUsers } = result.data;
      console.log(`[SYNC] Found ${updatedUsers.length} users with level changes out of ${totalUsers} total`);

      // 각 유저에게 역할 적용
      for (const user of updatedUsers) {
        console.log(`[SYNC] User ${user.userId}: Level ${user.oldLevel} -> ${user.newLevel}`);

        await this.applyLevelRewards(
          guildId,
          user.userId,
          user.rolesToAdd,
          user.rolesToRemove
        );
      }

      console.log(`[SYNC] Completed level sync for guild ${guildId}`);
      return {
        success: true,
        updatedCount: updatedUsers.length,
        totalUsers,
      };
    },

    /**
     * 해금 채널 설정 변경 시 모든 채널 권한을 동기화합니다.
     */
    async syncAllChannelPermissions(guildId: string): Promise<{
      success: boolean;
      lockedChannels: number;
      totalPermissionsSet: number;
    }> {
      console.log(`[CHANNEL SYNC] Starting channel sync for guild ${guildId}...`);

      const result = await container.xpService.syncAllUserChannels(guildId);

      if (!result.success) {
        console.error('[CHANNEL SYNC] Failed to sync channels:', result.error);
        return { success: false, lockedChannels: 0, totalPermissionsSet: 0 };
      }

      const { channelsToLock, userChannelPermissions } = result.data;

      try {
        const guild = await client.guilds.fetch(guildId);

        // 1. 모든 해금 채널 잠금 (@everyone ViewChannel 거부) + 기존 개별 권한 삭제
        for (const channelId of channelsToLock) {
          try {
            const channel = await guild.channels.fetch(channelId);
            if (channel && 'permissionOverwrites' in channel) {
              // 기존 멤버 개별 권한 삭제 (봇과 @everyone 제외)
              const overwrites = channel.permissionOverwrites.cache;
              for (const [id, overwrite] of overwrites) {
                if (overwrite.type === 1) { // 1 = member
                  try {
                    await overwrite.delete();
                    console.log(`[CHANNEL SYNC] Removed permission for user ${id} on channel ${channelId}`);
                  } catch (err) {
                    console.error(`[CHANNEL SYNC] Failed to remove permission for ${id}:`, err);
                  }
                }
              }

              // @everyone 권한 거부
              await channel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: false,
              });
              console.log(`[CHANNEL SYNC] Locked channel ${channelId}`);
            }
          } catch (err) {
            console.error(`[CHANNEL SYNC] Failed to lock channel ${channelId}:`, err);
          }
        }

        // 2. 자격 있는 유저들에게 채널 권한 부여
        let totalPermissionsSet = 0;
        for (const { channelId, userIds } of userChannelPermissions) {
          try {
            const channel = await guild.channels.fetch(channelId);
            if (channel && 'permissionOverwrites' in channel) {
              for (const userId of userIds) {
                try {
                  const member = await guild.members.fetch(userId);
                  await channel.permissionOverwrites.edit(member, {
                    ViewChannel: true,
                    SendMessages: true,
                  });
                  totalPermissionsSet++;
                } catch (err) {
                  // 멤버를 찾을 수 없는 경우 무시
                  console.error(`[CHANNEL SYNC] Failed to set permission for user ${userId}:`, err);
                }
              }
              console.log(`[CHANNEL SYNC] Set permissions for ${userIds.length} users on channel ${channelId}`);
            }
          } catch (err) {
            console.error(`[CHANNEL SYNC] Failed to process channel ${channelId}:`, err);
          }
        }

        console.log(`[CHANNEL SYNC] Completed channel sync for guild ${guildId}`);
        return {
          success: true,
          lockedChannels: channelsToLock.length,
          totalPermissionsSet,
        };
      } catch (error) {
        console.error('[CHANNEL SYNC] Failed to sync channel permissions:', error);
        return { success: false, lockedChannels: 0, totalPermissionsSet: 0 };
      }
    },
  };
}
