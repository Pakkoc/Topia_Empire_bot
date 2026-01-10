-- 레벨업 알림 활성화 여부 컬럼 추가
ALTER TABLE xp_settings
ADD COLUMN level_up_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER voice_max_per_cooldown;
