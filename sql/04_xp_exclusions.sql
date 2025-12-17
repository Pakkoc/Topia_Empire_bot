-- XP 제외 채널/역할 테이블
CREATE TABLE IF NOT EXISTS xp_exclusions (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    target_type ENUM('channel', 'role') NOT NULL,
    target_id VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_xp_exclusions_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    UNIQUE KEY uk_xp_exclusions (guild_id, target_type, target_id),
    INDEX idx_xp_exclusions_lookup (guild_id, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
