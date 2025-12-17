export type RepositoryError =
  | { type: 'CONNECTION_ERROR'; message: string }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'TIMEOUT'; message: string }
  | { type: 'NOT_FOUND'; message: string };

export type XpError =
  | { type: 'REPOSITORY_ERROR'; cause: RepositoryError }
  | { type: 'SETTINGS_NOT_FOUND'; guildId: string }
  | { type: 'EXCLUDED_CHANNEL'; channelId: string }
  | { type: 'EXCLUDED_ROLE'; roleId: string }
  | { type: 'COOLDOWN_ACTIVE'; remainingSeconds: number }
  | { type: 'XP_DISABLED'; guildId: string };
