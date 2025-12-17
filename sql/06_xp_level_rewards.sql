-- 레벨 보상 역할 테이블
CREATE TABLE IF NOT EXISTS xp_level_rewards (
    id INT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    level INT NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    remove_on_higher_level BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_xp_level_rewards_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,

    UNIQUE KEY uk_xp_level_rewards (guild_id, level, role_id),
    INDEX idx_xp_level_rewards_level (guild_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
