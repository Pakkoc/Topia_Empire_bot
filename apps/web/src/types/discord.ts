export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface DiscordGuildWithBot extends DiscordGuild {
  botJoined: boolean;
}

// Discord permission flags
export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 0x8,
  MANAGE_GUILD: 0x20,
} as const;

export function hasManageGuildPermission(permissions: string): boolean {
  const permBigInt = BigInt(permissions);
  return (
    (permBigInt & BigInt(DISCORD_PERMISSIONS.ADMINISTRATOR)) !== BigInt(0) ||
    (permBigInt & BigInt(DISCORD_PERMISSIONS.MANAGE_GUILD)) !== BigInt(0)
  );
}
