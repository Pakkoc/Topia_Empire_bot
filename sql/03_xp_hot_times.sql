-- XP 핫타임 설정 테이블
CREATE TABLE IF NOT EXISTS xp_hot_times (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    type ENUM('text', 'voice', 'all') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.50,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_xp_hot_times_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    INDEX idx_xp_hot_times_lookup (guild_id, type, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
