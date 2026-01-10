import type { Client, TextChannel } from 'discord.js';
import type { Container } from '@topia/infra';
import type { LevelRewardInfo, XpType } from '@topia/core';

const DEFAULT_TEXT_LEVEL_UP_MESSAGE = '🎉 축하합니다 {user}님! **텍스트 레벨 {level}**에 도달하셨습니다!';
const DEFAULT_VOICE_LEVEL_UP_MESSAGE = '🎉 축하합니다 {user}님! **음성 레벨 {level}**에 도달하셨습니다!';

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
          `[TEXT XP] ${userId} earned ${result.data.xp} XP (total: ${result.data.totalXp}, text level: ${result.data.level})`
        );

        if (result.data.leveledUp) {
          console.log(`[TEXT LEVEL UP] ${userId} reached text level ${result.data.level}!`);

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
            'text',
            result.data.levelUpNotificationEnabled,
            result.data.levelUpChannelId,
            result.data.levelUpMessage
          );
        }
      } else if (result.data.reason) {
        console.log(`[TEXT XP BLOCKED] ${userId} in channel ${channelId} - reason: ${result.data.reason}`);
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
      xpType: XpType,
      levelUpNotificationEnabled?: boolean,
      levelUpChannelId?: string | null,
      customMessage?: string | null
    ): Promise<void> {
      // 알림이 비활성화된 경우 전송하지 않음
      if (levelUpNotificationEnabled === false) {
        console.log('[LEVEL UP] Notification disabled in settings');
        return;
      }

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
        const defaultMessage = xpType === 'text' ? DEFAULT_TEXT_LEVEL_UP_MESSAGE : DEFAULT_VOICE_LEVEL_UP_MESSAGE;
        const messageTemplate = customMessage || defaultMessage;
        const typeLabel = xpType === 'text' ? '텍스트' : '음성';
        const formattedMessage = messageTemplate
          .replace(/{user}/g, `<@${userId}>`)
          .replace(/{username}/g, user.username)
          .replace(/{displayname}/g, member.displayName)
          .replace(/{level}/g, level.toString())
          .replace(/{xp}/g, xp.toLocaleString())
          .replace(/{server}/g, guild.name)
          .replace(/{type}/g, typeLabel);

        await (channel as TextChannel).send(formattedMessage);
        console.log(`[${xpType.toUpperCase()} LEVEL UP] Sent notification to channel ${levelUpChannelId}`);
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
          `[VOICE XP] ${userId} earned ${result.data.xp} XP (total: ${result.data.totalXp}, voice level: ${result.data.level})`
        );

        if (result.data.leveledUp) {
          console.log(`[VOICE LEVEL UP] ${userId} reached voice level ${result.data.level}!`);

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
            'voice',
            result.data.levelUpNotificationEnabled,
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
     * xpType을 지정하면 해당 타입만 동기화, 지정하지 않으면 둘 다 동기화
     */
    async syncAllUserLevelsAndRewards(guildId: string, xpType?: XpType): Promise<{
      success: boolean;
      textUpdatedCount: number;
      voiceUpdatedCount: number;
      totalUsers: number;
    }> {
      console.log(`[SYNC] Starting level sync for guild ${guildId} (type: ${xpType || 'all'})...`);

      let textUpdatedCount = 0;
      let voiceUpdatedCount = 0;
      let totalUsers = 0;

      // Sync text levels
      if (!xpType || xpType === 'text') {
        const textResult = await container.xpService.syncAllUserTextLevels(guildId);
        if (!textResult.success) {
          console.error('[SYNC] Failed to sync text levels:', textResult.error);
        } else {
          const { updatedUsers, totalUsers: total } = textResult.data;
          totalUsers = total;
          console.log(`[SYNC] Found ${updatedUsers.length} users with text level changes`);

          for (const user of updatedUsers) {
            console.log(`[SYNC] User ${user.userId}: Text Level ${user.oldLevel} -> ${user.newLevel}`);
            await this.applyLevelRewards(guildId, user.userId, user.rolesToAdd, user.rolesToRemove);
          }
          textUpdatedCount = updatedUsers.length;
        }
      }

      // Sync voice levels
      if (!xpType || xpType === 'voice') {
        const voiceResult = await container.xpService.syncAllUserVoiceLevels(guildId);
        if (!voiceResult.success) {
          console.error('[SYNC] Failed to sync voice levels:', voiceResult.error);
        } else {
          const { updatedUsers, totalUsers: total } = voiceResult.data;
          if (total > totalUsers) totalUsers = total;
          console.log(`[SYNC] Found ${updatedUsers.length} users with voice level changes`);

          for (const user of updatedUsers) {
            console.log(`[SYNC] User ${user.userId}: Voice Level ${user.oldLevel} -> ${user.newLevel}`);
            await this.applyLevelRewards(guildId, user.userId, user.rolesToAdd, user.rolesToRemove);
          }
          voiceUpdatedCount = updatedUsers.length;
        }
      }

      console.log(`[SYNC] Completed level sync for guild ${guildId}`);
      return {
        success: true,
        textUpdatedCount,
        voiceUpdatedCount,
        totalUsers,
      };
    },

    /**
     * 해금 채널 설정 변경 시 모든 채널 권한을 동기화합니다.
     * xpType을 지정하면 해당 타입만 동기화, 지정하지 않으면 둘 다 동기화
     */
    async syncAllChannelPermissions(guildId: string, xpType?: XpType): Promise<{
      success: boolean;
      lockedChannels: number;
      totalPermissionsSet: number;
    }> {
      console.log(`[CHANNEL SYNC] Starting channel sync for guild ${guildId} (type: ${xpType || 'all'})...`);

      let allChannelsToLock: string[] = [];
      let allUserChannelPermissions: { channelId: string; userIds: string[] }[] = [];

      // Sync text channels
      if (!xpType || xpType === 'text') {
        const textResult = await container.xpService.syncAllUserTextChannels(guildId);
        if (!textResult.success) {
          console.error('[CHANNEL SYNC] Failed to sync text channels:', textResult.error);
        } else {
          allChannelsToLock = [...allChannelsToLock, ...textResult.data.channelsToLock];
          allUserChannelPermissions = [...allUserChannelPermissions, ...textResult.data.userChannelPermissions];
        }
      }

      // Sync voice channels
      if (!xpType || xpType === 'voice') {
        const voiceResult = await container.xpService.syncAllUserVoiceChannels(guildId);
        if (!voiceResult.success) {
          console.error('[CHANNEL SYNC] Failed to sync voice channels:', voiceResult.error);
        } else {
          // 중복 제거 (같은 채널이 text/voice 둘 다 있을 수 있음)
          for (const channelId of voiceResult.data.channelsToLock) {
            if (!allChannelsToLock.includes(channelId)) {
              allChannelsToLock.push(channelId);
            }
          }
          allUserChannelPermissions = [...allUserChannelPermissions, ...voiceResult.data.userChannelPermissions];
        }
      }

      const channelsToLock = allChannelsToLock;
      const userChannelPermissions = allUserChannelPermissions;

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
