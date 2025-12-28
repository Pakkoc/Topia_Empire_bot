-- 유저 인벤토리에 현재 적용 중인 고정 역할 추가
-- 고정 역할이 부여된 경우 추적하여 만료 시 함께 제거

ALTER TABLE user_items_v2
ADD COLUMN fixed_role_id VARCHAR(20) NULL AFTER current_role_applied_at;
