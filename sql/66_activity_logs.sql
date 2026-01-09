-- 서버 인원 활동 시간대 로그 테이블
-- 히트맵 차트 표시를 위한 활동 기록 저장

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    guild_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    activity_type ENUM('text', 'voice') NOT NULL,
    activity_time DATETIME NOT NULL,

    PRIMARY KEY (id),
    INDEX idx_activity_guild_time (guild_id, activity_time),
    INDEX idx_activity_type (guild_id, activity_type),
    INDEX idx_activity_user (guild_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 오래된 로그 정리를 위한 파티셔닝 고려
-- 또는 정기적인 배치 작업으로 30일 이상 된 로그 삭제
