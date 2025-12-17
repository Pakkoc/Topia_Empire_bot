-- XP 배율 채널/역할 테이블 (확장 기능)
CREATE TABLE IF NOT EXISTS xp_multipliers (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    target_type ENUM('channel', 'role') NOT NULL,
    target_id VARCHAR(20) NOT NULL,
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_xp_multipliers_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    UNIQUE KEY uk_xp_multipliers (guild_id, target_type, target_id),
    INDEX idx_xp_multipliers_lookup (guild_id, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
