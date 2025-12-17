-- 레벨 해금 채널 테이블
CREATE TABLE IF NOT EXISTS xp_level_channels (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    level INT NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_xp_level_channels_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    UNIQUE KEY uk_xp_level_channels_channel (guild_id, channel_id),
    INDEX idx_xp_level_channels_level (guild_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
