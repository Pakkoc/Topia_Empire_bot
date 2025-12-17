-- 유저별 XP 데이터 테이블
CREATE TABLE IF NOT EXISTS xp_users (
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 0,

    -- 텍스트 XP 쿨다운 추적
    last_text_xp_at DATETIME NULL,
    text_count_in_cooldown INT NOT NULL DEFAULT 0,

    -- 음성 XP 쿨다운 추적
    last_voice_xp_at DATETIME NULL,
    voice_count_in_cooldown INT NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (guild_id, user_id),
    CONSTRAINT fk_xp_users_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    INDEX idx_xp_users_level (guild_id, level DESC),
    INDEX idx_xp_users_xp (guild_id, xp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
