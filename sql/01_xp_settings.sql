-- XP 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS xp_settings (
    guild_id VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- 텍스트 XP 설정
    text_xp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    text_xp_min INT NOT NULL DEFAULT 15,
    text_xp_max INT NOT NULL DEFAULT 25,
    text_cooldown_seconds INT NOT NULL DEFAULT 60,
    text_max_per_cooldown INT NOT NULL DEFAULT 1,

    -- 음성 XP 설정
    voice_xp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    voice_xp_min INT NOT NULL DEFAULT 10,
    voice_xp_max INT NOT NULL DEFAULT 20,
    voice_cooldown_seconds INT NOT NULL DEFAULT 60,
    voice_max_per_cooldown INT NOT NULL DEFAULT 1,

    -- 레벨업 알림 설정
    level_up_channel_id VARCHAR(20) NULL,
    level_up_message TEXT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id),
    CONSTRAINT fk_xp_settings_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
