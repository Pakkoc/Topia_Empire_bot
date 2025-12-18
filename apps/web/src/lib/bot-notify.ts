/**
 * 봇 API에 설정 변경 알림을 보내는 유틸리티 함수
 */

const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3001';

export type SettingType =
  | 'xp-settings'
  | 'xp-text'
  | 'xp-voice'
  | 'xp-exclusion'
  | 'xp-hottime'
  | 'xp-reward'
  | 'xp-notification'
  | 'xp-level-requirement'
  | 'xp-level-channel';

export type SettingAction = '추가' | '수정' | '삭제' | '변경';

interface NotifySettingsChangedParams {
  guildId: string;
  type: SettingType;
  action: SettingAction;
  details?: string;
}

/**
 * 봇에 설정 변경 알림을 보냅니다.
 * 실패해도 에러를 throw하지 않고 로그만 남깁니다.
 */
export async function notifyBotSettingsChanged({
  guildId,
  type,
  action,
  details,
}: NotifySettingsChangedParams): Promise<void> {
  try {
    const response = await fetch(`${BOT_API_URL}/api/notify/settings-changed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guildId,
        type,
        action,
        details,
      }),
    });

    if (!response.ok) {
      console.error(`[BOT NOTIFY] Failed to notify bot: ${response.status}`);
    }
  } catch (error) {
    // 봇이 오프라인이거나 연결 실패 시 무시
    console.error('[BOT NOTIFY] Failed to connect to bot:', error);
  }
}

/**
 * 봇에 채널 잠금 요청을 보냅니다.
 * 해금 채널 등록 시 @everyone의 ViewChannel 권한을 거부합니다.
 */
export async function lockChannel(guildId: string, channelId: string): Promise<boolean> {
  try {
    const response = await fetch(`${BOT_API_URL}/api/channels/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ guildId, channelId }),
    });

    if (!response.ok) {
      console.error(`[BOT] Failed to lock channel: ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[BOT] Failed to connect to bot for channel lock:', error);
    return false;
  }
}
