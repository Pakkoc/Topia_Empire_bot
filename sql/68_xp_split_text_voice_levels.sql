-- 음성/텍스트 레벨 분리 마이그레이션
-- 기존 통합 레벨(level)을 텍스트 레벨(text_level)과 음성 레벨(voice_level)로 분리

-- 1. xp_users 테이블: text_level, voice_level 컬럼 추가
ALTER TABLE xp_users
ADD COLUMN text_level INT NOT NULL DEFAULT 0 AFTER voice_xp,
ADD COLUMN voice_level INT NOT NULL DEFAULT 0 AFTER text_level;

-- 기존 데이터 마이그레이션: 각 XP 기반으로 레벨 재계산
-- 기본 공식: level = floor(sqrt(xp / 100))
UPDATE xp_users
SET text_level = FLOOR(SQRT(text_xp / 100)),
    voice_level = FLOOR(SQRT(voice_xp / 100));

-- 기존 level, xp 컬럼 삭제
ALTER TABLE xp_users DROP COLUMN level;
ALTER TABLE xp_users DROP COLUMN xp;

-- 기존 인덱스 삭제 후 새 인덱스 추가
ALTER TABLE xp_users DROP INDEX idx_xp_users_level;
ALTER TABLE xp_users DROP INDEX idx_xp_users_xp;
ALTER TABLE xp_users ADD INDEX idx_xp_users_text_level (guild_id, text_level DESC);
ALTER TABLE xp_users ADD INDEX idx_xp_users_voice_level (guild_id, voice_level DESC);

-- 2. xp_level_requirements 테이블: type 컬럼 추가
ALTER TABLE xp_level_requirements
ADD COLUMN type ENUM('text', 'voice') NOT NULL DEFAULT 'text' AFTER guild_id;

-- 기존 데이터를 voice 타입으로 복제
INSERT INTO xp_level_requirements (guild_id, type, level, required_xp)
SELECT guild_id, 'voice', level, required_xp
FROM xp_level_requirements
WHERE type = 'text'
ON DUPLICATE KEY UPDATE required_xp = VALUES(required_xp);

-- Primary Key 변경 (guild_id, type, level)
ALTER TABLE xp_level_requirements DROP PRIMARY KEY;
ALTER TABLE xp_level_requirements ADD PRIMARY KEY (guild_id, type, level);

-- 3. xp_level_rewards 테이블: type 컬럼 추가
ALTER TABLE xp_level_rewards
ADD COLUMN type ENUM('text', 'voice') NOT NULL DEFAULT 'text' AFTER guild_id;

-- Unique Key 및 인덱스 변경
ALTER TABLE xp_level_rewards DROP INDEX uk_xp_level_rewards;
ALTER TABLE xp_level_rewards ADD UNIQUE KEY uk_xp_level_rewards (guild_id, type, level, role_id);
ALTER TABLE xp_level_rewards DROP INDEX idx_xp_level_rewards_level;
ALTER TABLE xp_level_rewards ADD INDEX idx_xp_level_rewards_level (guild_id, type, level);

-- 4. xp_level_channels 테이블: type 컬럼 추가
ALTER TABLE xp_level_channels
ADD COLUMN type ENUM('text', 'voice') NOT NULL DEFAULT 'text' AFTER guild_id;

-- Unique Key 변경 (채널은 타입별로 다른 레벨에 연결 가능)
ALTER TABLE xp_level_channels DROP INDEX uk_xp_level_channels_channel;
ALTER TABLE xp_level_channels ADD UNIQUE KEY uk_xp_level_channels_channel (guild_id, type, channel_id);
ALTER TABLE xp_level_channels DROP INDEX idx_xp_level_channels_level;
ALTER TABLE xp_level_channels ADD INDEX idx_xp_level_channels_level (guild_id, type, level);
