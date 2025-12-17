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
      }
    },
  };
}
