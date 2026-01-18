-- 내전 생성 승인 시스템을 위한 마이그레이션
-- games 테이블 status에 pending_approval 추가
-- game_settings에 승인 채널 추가

-- games 테이블 status 컬럼에 pending_approval 추가
ALTER TABLE games
MODIFY COLUMN status ENUM('pending_approval', 'open', 'team_assign', 'in_progress', 'finished', 'cancelled')
NOT NULL DEFAULT 'open';

-- game_settings에 승인 채널 ID 추가
ALTER TABLE game_settings
ADD COLUMN approval_channel_id VARCHAR(20) NULL AFTER manager_role_id;
