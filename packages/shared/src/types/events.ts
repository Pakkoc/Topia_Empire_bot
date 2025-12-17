export type SettingsEventType =
  | 'xp_settings_updated'
  | 'level_rewards_updated'
  | 'exclusions_updated';

export interface SettingsEvent {
  type: SettingsEventType;
  guildId: string;
  timestamp: number;
  payload: unknown;
}

export type XpEventType =
  | 'xp_granted'
  | 'level_up';

export interface XpEvent {
  type: XpEventType;
  guildId: string;
  userId: string;
  timestamp: number;
  payload: {
    xp?: number;
    level?: number;
    previousLevel?: number;
  };
}
