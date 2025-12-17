// Discord Bot Client ID (same as OAuth app)
const BOT_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1450932450464108755";

// Bot permissions needed for XP system
// - Read Messages/View Channels (1024)
// - Send Messages (2048)
// - Manage Roles (268435456)
// - Read Message History (65536)
// - Add Reactions (64)
// - Use External Emojis (262144)
// - Connect (1048576)
// - Speak (2097152)
const BOT_PERMISSIONS = "268503126";

/**
 * Generate Discord bot invite URL
 * @param guildId - Optional guild ID to pre-select the server
 */
export function getBotInviteUrl(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: BOT_CLIENT_ID,
    permissions: BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });

  if (guildId) {
    params.append("guild_id", guildId);
  }

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
